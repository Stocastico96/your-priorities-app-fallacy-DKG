"use strict";

const { OpenAI } = require("openai");
const models = require("../../models/index.cjs");
const log = require("../../utils/logger.cjs");

/**
 * PSV Calculator Service
 * Calculates Perspectivized Stance Vectors for comments using LLM analysis
 */
class PSVCalculator {
  constructor() {
    // Initialize OpenAI client (can be configured to use OpenRouter)
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const baseURL = process.env.OPENROUTER_API_KEY
      ? "https://openrouter.ai/api/v1"
      : undefined;

    this.openai = new OpenAI({
      apiKey,
      baseURL
    });

    // Model selection: deepseek-chat via OpenRouter or GPT-4 via OpenAI
    this.model = process.env.OPENROUTER_API_KEY
      ? "deepseek/deepseek-chat"
      : "gpt-4o-mini";

    this.temperature = 0.3; // Lower temperature for more consistent analysis
    this.maxTokens = 1000;
  }

  /**
   * Build the analysis prompt for a single dimension
   */
  buildPrompt(commentText, dimension) {
    return `You are an expert political analyst evaluating public comments on deliberation topics.

Analyze the following comment's stance on this specific dimension:

**Dimension**: ${dimension.dimension_name}
**Description**: ${dimension.dimension_description}
**Scale**:
- Negative (-1): ${dimension.scale_negative_label}
- Neutral (0): No clear stance or mixed
- Positive (+1): ${dimension.scale_positive_label}

**Comment to analyze**:
"${commentText}"

Provide your analysis in JSON format:
{
  "stance_value": <number between -1 and 1>,
  "confidence": <number between 0 and 1>,
  "explanation": "<brief 1-2 sentence explanation>"
}

Rules:
1. stance_value: Rate from -1.0 to +1.0 based on the comment's position on this dimension
2. confidence: How confident are you in this rating? (0 = not confident, 1 = very confident)
3. If the comment doesn't address this dimension, use stance_value: 0 and confidence: 0
4. explanation: Brief justification for your rating

Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse LLM response and extract structured data
   */
  parseLLMResponse(responseText) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (
        typeof parsed.stance_value !== "number" ||
        typeof parsed.confidence !== "number" ||
        typeof parsed.explanation !== "string"
      ) {
        throw new Error("Invalid JSON structure");
      }

      // Clamp values to valid ranges
      parsed.stance_value = Math.max(-1, Math.min(1, parsed.stance_value));
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      return parsed;
    } catch (error) {
      log.error("Error parsing LLM response", { error, responseText });
      // Return neutral values on parse error
      return {
        stance_value: 0,
        confidence: 0,
        explanation: "Failed to parse LLM response"
      };
    }
  }

  /**
   * Analyze a comment's stance on a single dimension
   */
  async analyzeStanceOnDimension(commentText, dimension) {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(commentText, dimension);

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert analyst providing structured JSON analysis of text positions on policy dimensions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens
      });

      const responseText = completion.choices[0].message.content;
      const processingTime = Date.now() - startTime;

      const parsed = this.parseLLMResponse(responseText);

      return {
        ...parsed,
        raw_llm_response: {
          full_response: responseText,
          model: this.model,
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens,
          total_tokens: completion.usage?.total_tokens
        },
        processing_time_ms: processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      log.error("Error analyzing stance on dimension", {
        error: error.message,
        dimensionId: dimension.id,
        commentLength: commentText.length
      });

      // Return neutral values on error
      return {
        stance_value: 0,
        confidence: 0,
        explanation: `Error during analysis: ${error.message}`,
        raw_llm_response: { error: error.message },
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Calculate full PSV for a comment across all relevant dimensions
   */
  async calculatePSV(pointId) {
    const overallStartTime = Date.now();

    try {
      // Fetch the comment/point
      const point = await models.Point.findByPk(pointId);
      if (!point) {
        throw new Error(`Point ${pointId} not found`);
      }

      // Get dimensions (post-level first, then group-level)
      let dimensions = await models.DeliberationDimension.findAll({
        where: {
          post_id: point.post_id,
          active: true
        },
        order: [['position', 'ASC']]
      });

      // Fall back to group-level dimensions if no post-level dimensions
      if (dimensions.length === 0 && point.group_id) {
        dimensions = await models.DeliberationDimension.findAll({
          where: {
            group_id: point.group_id,
            post_id: null,
            active: true
          },
          order: [['position', 'ASC']]
        });
      }

      if (dimensions.length === 0) {
        log.warn("No dimensions found for point", { pointId, postId: point.post_id });
        return {
          success: false,
          message: "No dimensions configured for this deliberation"
        };
      }

      // Analyze stance on each dimension
      const results = [];
      for (const dimension of dimensions) {
        const analysis = await this.analyzeStanceOnDimension(
          point.content,
          dimension
        );

        // Store or update the stance vector
        const [stanceVector, created] = await models.CommentStanceVector.upsert({
          point_id: pointId,
          dimension_id: dimension.id,
          stance_value: analysis.stance_value,
          confidence: analysis.confidence,
          explanation: analysis.explanation,
          raw_llm_response: analysis.raw_llm_response,
          processing_time_ms: analysis.processing_time_ms
        });

        results.push({
          dimension: dimension.dimension_name,
          stance_value: analysis.stance_value,
          confidence: analysis.confidence,
          explanation: analysis.explanation,
          created
        });

        log.info("Calculated stance for dimension", {
          pointId,
          dimensionId: dimension.id,
          dimensionName: dimension.dimension_name,
          stanceValue: analysis.stance_value,
          confidence: analysis.confidence
        });
      }

      const totalTime = Date.now() - overallStartTime;

      return {
        success: true,
        pointId,
        dimensions: results,
        totalProcessingTimeMs: totalTime,
        averageTimePerDimension: Math.round(totalTime / dimensions.length)
      };
    } catch (error) {
      log.error("Error calculating PSV", { error, pointId });
      throw error;
    }
  }

  /**
   * Get existing PSV for a point
   */
  async getPSV(pointId) {
    try {
      const stanceVectors = await models.CommentStanceVector.findAll({
        where: { point_id: pointId },
        include: [
          {
            model: models.DeliberationDimension,
            as: 'Dimension',
            where: { active: true }
          }
        ],
        order: [[{ model: models.DeliberationDimension, as: 'Dimension' }, 'position', 'ASC']]
      });

      return {
        pointId,
        vector: stanceVectors.map(sv => ({
          dimension: sv.Dimension.dimension_name,
          dimensionId: sv.dimension_id,
          stanceValue: sv.stance_value,
          confidence: sv.confidence,
          explanation: sv.explanation,
          updatedAt: sv.updated_at
        }))
      };
    } catch (error) {
      log.error("Error getting PSV", { error, pointId });
      throw error;
    }
  }

  /**
   * Recalculate PSV for a point (e.g., if dimensions changed)
   */
  async recalculatePSV(pointId) {
    try {
      // Delete existing vectors
      await models.CommentStanceVector.destroy({
        where: { point_id: pointId }
      });

      // Recalculate
      return await this.calculatePSV(pointId);
    } catch (error) {
      log.error("Error recalculating PSV", { error, pointId });
      throw error;
    }
  }
}

module.exports = new PSVCalculator();

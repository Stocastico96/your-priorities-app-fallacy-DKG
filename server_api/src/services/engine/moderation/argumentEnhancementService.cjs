"use strict";

const { OpenAI } = require("openai");
const log = require("../../../utils/logger.cjs");

/**
 * Argument Enhancement Service
 * Analyzes user arguments for structural components and provides suggestions
 * Based on Toulmin's model of argumentation
 */
class ArgumentEnhancementService {
  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
    });

    // Use DeepSeek as primary model (cost-effective and fast)
    this.primaryModel = process.env.ARGUMENT_ENHANCEMENT_MODEL || "deepseek/deepseek-chat";
    this.fallbackModel = "openai/gpt-4o-mini";
    this.temperature = 0.3; // Lower temperature for more consistent analysis
    this.maxTokens = 2000;
  }

  /**
   * Analyzes an argument and returns structural components and suggestions
   * @param {string} text - The argument text to analyze
   * @param {object} context - Additional context (postId, language, etc.)
   * @returns {Promise<object>} Analysis results with components and suggestions
   */
  async analyzeArgument(text, context = {}) {
    try {
      const startTime = Date.now();

      // Validate input
      if (!text || text.trim().length === 0) {
        return {
          error: "No text provided for analysis",
          components: {},
          suggestions: [],
          strengthScore: 0
        };
      }

      if (text.trim().length < 10) {
        return {
          error: "Text too short for meaningful analysis",
          components: {},
          suggestions: ["Your argument is too short. Please provide more detail."],
          strengthScore: 1
        };
      }

      // Build the analysis prompt
      const systemPrompt = this._buildSystemPrompt();
      const userPrompt = this._buildUserPrompt(text, context);

      // Call OpenAI API
      let analysis;
      try {
        analysis = await this._callLLM(systemPrompt, userPrompt, this.primaryModel);
      } catch (primaryError) {
        log.warn("Primary model failed, trying fallback", { error: primaryError.message });
        analysis = await this._callLLM(systemPrompt, userPrompt, this.fallbackModel);
      }

      const processingTime = Date.now() - startTime;
      log.info("Argument analysis completed", {
        textLength: text.length,
        processingTime,
        model: this.primaryModel,
        hasComponents: !!analysis.components,
        suggestionCount: analysis.suggestions?.length || 0
      });

      return {
        ...analysis,
        metadata: {
          processingTime,
          model: this.primaryModel,
          textLength: text.length
        }
      };

    } catch (error) {
      log.error("Argument analysis failed", {
        error: error.message,
        stack: error.stack
      });

      return {
        error: "Failed to analyze argument. Please try again.",
        components: {},
        suggestions: [],
        strengthScore: 0,
        metadata: {
          error: error.message
        }
      };
    }
  }

  /**
   * Calls the LLM API with retry logic
   * @private
   */
  async _callLLM(systemPrompt, userPrompt, model) {
    const response = await this.openaiClient.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Validate the response structure
    return this._validateAndNormalizeResponse(parsed);
  }

  /**
   * Builds the system prompt for the LLM
   * @private
   */
  _buildSystemPrompt() {
    return `You are an expert in deliberative democracy and argumentation analysis. Your role is to help users improve their arguments in civic discussions.

Analyze arguments using Toulmin's model of argumentation, identifying:
1. CLAIM: The main assertion or position being argued
2. EVIDENCE: Facts, data, examples, or sources that support the claim
3. WARRANT: The reasoning that connects evidence to the claim
4. QUALIFIERS: Words/phrases that limit the claim's scope (e.g., "usually", "in most cases")
5. BACKING: Additional support for the warrant
6. REBUTTALS: Acknowledgment of counterarguments or limitations

Provide a strength assessment:
- WEAK (1-3): Missing multiple key components, unclear claim, no evidence
- MODERATE (4-6): Has claim and some evidence, but missing warrant or qualifiers
- STRONG (7-10): Clear claim, solid evidence, explicit warrant, acknowledges limitations

Provide 3-5 specific, actionable suggestions to improve the argument. Focus on what's missing or weak.

IMPORTANT:
- Be constructive and encouraging
- Suggestions must be specific and actionable
- Respect all viewpoints; focus on argument structure, not content
- Support multilingual analysis
- Return response as valid JSON only

Response format:
{
  "components": {
    "claim": { "present": boolean, "text": string or null, "strength": 1-10 },
    "evidence": { "present": boolean, "text": string or null, "strength": 1-10 },
    "warrant": { "present": boolean, "text": string or null, "strength": 1-10 },
    "qualifiers": { "present": boolean, "text": string or null, "strength": 1-10 },
    "backing": { "present": boolean, "text": string or null, "strength": 1-10 },
    "rebuttals": { "present": boolean, "text": string or null, "strength": 1-10 }
  },
  "strengthScore": number (1-10),
  "strengthLevel": "weak" | "moderate" | "strong",
  "suggestions": [
    {
      "type": "claim" | "evidence" | "warrant" | "qualifiers" | "rebuttals" | "structure",
      "priority": "high" | "medium" | "low",
      "message": "Specific suggestion text",
      "example": "Optional example of how to improve"
    }
  ],
  "summary": "Brief 1-2 sentence summary of the analysis"
}`;
  }

  /**
   * Builds the user prompt with the text to analyze
   * @private
   */
  _buildUserPrompt(text, context) {
    let prompt = `Analyze the following argument:\n\n"${text}"`;

    if (context.language) {
      prompt += `\n\nLanguage: ${context.language}`;
    }

    if (context.discussionTopic) {
      prompt += `\n\nDiscussion topic: ${context.discussionTopic}`;
    }

    prompt += `\n\nProvide your analysis in JSON format as specified.`;

    return prompt;
  }

  /**
   * Validates and normalizes the LLM response
   * @private
   */
  _validateAndNormalizeResponse(response) {
    // Ensure all required fields exist
    const normalized = {
      components: response.components || {},
      strengthScore: this._normalizeScore(response.strengthScore),
      strengthLevel: response.strengthLevel || this._scoreToLevel(response.strengthScore),
      suggestions: Array.isArray(response.suggestions) ? response.suggestions : [],
      summary: response.summary || "Analysis completed."
    };

    // Ensure components have required structure
    const componentTypes = ['claim', 'evidence', 'warrant', 'qualifiers', 'backing', 'rebuttals'];
    componentTypes.forEach(type => {
      if (!normalized.components[type]) {
        normalized.components[type] = { present: false, text: null, strength: 0 };
      }
    });

    // Ensure suggestions have required fields
    normalized.suggestions = normalized.suggestions.map((s, index) => ({
      type: s.type || 'structure',
      priority: s.priority || 'medium',
      message: s.message || s.text || 'Consider improving this aspect',
      example: s.example || null,
      id: index + 1
    }));

    return normalized;
  }

  /**
   * Normalizes a score to 1-10 range
   * @private
   */
  _normalizeScore(score) {
    const num = parseInt(score, 10);
    if (isNaN(num)) return 5;
    return Math.max(1, Math.min(10, num));
  }

  /**
   * Converts a numeric score to a strength level
   * @private
   */
  _scoreToLevel(score) {
    const normalized = this._normalizeScore(score);
    if (normalized <= 3) return 'weak';
    if (normalized <= 6) return 'moderate';
    return 'strong';
  }

  /**
   * Provides quick feedback on argument length and basic quality
   * Used for debounced real-time feedback
   * @param {string} text - The argument text
   * @returns {object} Quick feedback
   */
  quickCheck(text) {
    const wordCount = text.trim().split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

    const feedback = {
      wordCount,
      sentenceCount,
      lengthFeedback: null,
      basicSuggestions: []
    };

    if (wordCount < 10) {
      feedback.lengthFeedback = "Your argument is quite short. Consider adding more detail.";
      feedback.basicSuggestions.push("Add specific examples or evidence");
    } else if (wordCount > 200) {
      feedback.lengthFeedback = "Your argument is detailed. Make sure your main point is clear.";
      feedback.basicSuggestions.push("Consider if you can make your main claim more concise");
    } else {
      feedback.lengthFeedback = "Good length for a clear argument.";
    }

    // Check for question marks (might be a question, not an argument)
    if (text.includes('?')) {
      feedback.basicSuggestions.push("Consider rephrasing questions as clear statements");
    }

    // Check for evidence markers
    const evidenceMarkers = ['because', 'since', 'as shown by', 'according to', 'research shows', 'data indicates', 'for example'];
    const hasEvidenceMarker = evidenceMarkers.some(marker => text.toLowerCase().includes(marker));
    if (!hasEvidenceMarker && wordCount > 20) {
      feedback.basicSuggestions.push("Consider adding evidence or reasoning (e.g., 'because...', 'for example...')");
    }

    return feedback;
  }
}

// Export singleton instance
let instance = null;

module.exports = {
  getService: () => {
    if (!instance) {
      instance = new ArgumentEnhancementService();
    }
    return instance;
  },
  ArgumentEnhancementService
};

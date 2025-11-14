"use strict";

const models = require("../../models/index.cjs");
const log = require("../../utils/logger.cjs");
const _ = require("lodash");

/**
 * Consensus Analyzer Service
 * Analyzes agreement and disagreement between stance vectors
 * to identify common ground and points of contention
 */
class ConsensusAnalyzer {
  /**
   * Calculate cosine similarity between two vectors
   * Returns value between -1 (opposite) and 1 (identical)
   */
  calculateCosineSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length || vector1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Classify agreement level based on similarity score
   */
  classifyAgreement(similarity) {
    if (similarity >= 0.8) {
      return "strong_agreement";
    } else if (similarity >= 0.5) {
      return "partial_agreement";
    } else if (similarity >= -0.2) {
      return "orthogonal"; // Talking past each other
    } else if (similarity >= -0.5) {
      return "partial_opposition";
    } else {
      return "strong_opposition";
    }
  }

  /**
   * Get PSV data for a point
   */
  async getPointPSV(pointId) {
    try {
      const stanceVectors = await models.CommentStanceVector.findAll({
        where: { point_id: pointId },
        include: [
          {
            model: models.DeliberationDimension,
            as: 'Dimension',
            where: { active: true },
            required: true
          }
        ],
        order: [[{ model: models.DeliberationDimension, as: 'Dimension' }, 'position', 'ASC']]
      });

      if (stanceVectors.length === 0) {
        return null;
      }

      return {
        pointId,
        dimensions: stanceVectors.map(sv => ({
          dimensionId: sv.dimension_id,
          dimensionName: sv.Dimension.dimension_name,
          stanceValue: sv.stance_value,
          confidence: sv.confidence
        })),
        vector: stanceVectors.map(sv => sv.stance_value),
        confidences: stanceVectors.map(sv => sv.confidence)
      };
    } catch (error) {
      log.error("Error getting point PSV", { error, pointId });
      throw error;
    }
  }

  /**
   * Analyze agreement between two comments
   */
  async analyzeAgreement(pointId1, pointId2) {
    try {
      const psv1 = await this.getPointPSV(pointId1);
      const psv2 = await this.getPointPSV(pointId2);

      if (!psv1 || !psv2) {
        return {
          success: false,
          message: "One or both points do not have stance vectors calculated"
        };
      }

      // Ensure vectors align on same dimensions
      const dimensionMap1 = _.keyBy(psv1.dimensions, 'dimensionId');
      const dimensionMap2 = _.keyBy(psv2.dimensions, 'dimensionId');

      const commonDimensionIds = _.intersection(
        Object.keys(dimensionMap1),
        Object.keys(dimensionMap2)
      );

      if (commonDimensionIds.length === 0) {
        return {
          success: false,
          message: "No common dimensions between the two points"
        };
      }

      // Build aligned vectors with confidence weighting
      const alignedVector1 = [];
      const alignedVector2 = [];
      const dimensionBreakdown = [];

      for (const dimId of commonDimensionIds) {
        const dim1 = dimensionMap1[dimId];
        const dim2 = dimensionMap2[dimId];

        alignedVector1.push(dim1.stanceValue);
        alignedVector2.push(dim2.stanceValue);

        // Calculate per-dimension similarity
        const dimSimilarity = 1 - Math.abs(dim1.stanceValue - dim2.stanceValue) / 2;
        const avgConfidence = (dim1.confidence + dim2.confidence) / 2;

        dimensionBreakdown.push({
          dimensionName: dim1.dimensionName,
          dimensionId: dimId,
          point1Stance: dim1.stanceValue,
          point2Stance: dim2.stanceValue,
          similarity: dimSimilarity,
          agreement: this.classifyAgreement(dimSimilarity),
          avgConfidence
        });
      }

      // Calculate overall cosine similarity
      const overallSimilarity = this.calculateCosineSimilarity(
        alignedVector1,
        alignedVector2
      );

      // Identify areas of common ground and contention
      const commonGround = dimensionBreakdown
        .filter(d => d.similarity >= 0.7)
        .map(d => d.dimensionName);

      const pointsOfContention = dimensionBreakdown
        .filter(d => d.similarity < 0.5)
        .map(d => d.dimensionName);

      // Sort dimensions by similarity (most similar first)
      dimensionBreakdown.sort((a, b) => b.similarity - a.similarity);

      return {
        success: true,
        pointId1,
        pointId2,
        overallSimilarity,
        overallAgreement: this.classifyAgreement(overallSimilarity),
        dimensionBreakdown,
        commonGround,
        pointsOfContention,
        analysisMetadata: {
          dimensionsAnalyzed: commonDimensionIds.length,
          averageConfidence: _.meanBy(dimensionBreakdown, 'avgConfidence')
        }
      };
    } catch (error) {
      log.error("Error analyzing agreement", { error, pointId1, pointId2 });
      throw error;
    }
  }

  /**
   * Calculate aggregate PSV for a post (community average)
   */
  async calculatePostAggregatePSV(postId) {
    try {
      // Get all points for the post
      const points = await models.Point.findAll({
        where: {
          post_id: postId,
          deleted: false,
          status: 'published'
        },
        attributes: ['id']
      });

      if (points.length === 0) {
        return {
          success: false,
          message: "No points found for this post"
        };
      }

      const pointIds = points.map(p => p.id);

      // Get all stance vectors for these points
      const stanceVectors = await models.CommentStanceVector.findAll({
        where: {
          point_id: pointIds
        },
        include: [
          {
            model: models.DeliberationDimension,
            as: 'Dimension',
            where: { active: true },
            required: true
          }
        ]
      });

      if (stanceVectors.length === 0) {
        return {
          success: false,
          message: "No stance vectors calculated for this post yet"
        };
      }

      // Group by dimension
      const dimensionGroups = _.groupBy(stanceVectors, 'dimension_id');

      const aggregates = [];
      for (const [dimensionId, vectors] of Object.entries(dimensionGroups)) {
        const dimension = vectors[0].Dimension;

        // Calculate weighted average (weighted by confidence)
        const totalConfidence = _.sumBy(vectors, 'confidence');
        const weightedSum = _.sumBy(vectors, v => v.stance_value * v.confidence);
        const avgStance = totalConfidence > 0 ? weightedSum / totalConfidence : 0;

        // Calculate standard deviation (measure of disagreement)
        const stanceValues = vectors.map(v => v.stance_value);
        const mean = _.mean(stanceValues);
        const variance = _.meanBy(stanceValues, val => Math.pow(val - mean, 2));
        const stdDev = Math.sqrt(variance);

        aggregates.push({
          dimensionId,
          dimensionName: dimension.dimension_name,
          averageStance: avgStance,
          standardDeviation: stdDev,
          consensus: stdDev < 0.3 ? "high" : stdDev < 0.6 ? "moderate" : "low",
          sampleSize: vectors.length,
          confidenceLevel: _.meanBy(vectors, 'confidence')
        });
      }

      // Sort by position
      aggregates.sort((a, b) => {
        const dimA = stanceVectors.find(v => v.dimension_id.toString() === a.dimensionId);
        const dimB = stanceVectors.find(v => v.dimension_id.toString() === b.dimensionId);
        return (dimA?.Dimension?.position || 0) - (dimB?.Dimension?.position || 0);
      });

      return {
        success: true,
        postId,
        aggregateStances: aggregates,
        metadata: {
          totalPoints: pointIds.length,
          pointsWithVectors: _.uniq(stanceVectors.map(v => v.point_id)).length,
          dimensionsAnalyzed: aggregates.length
        }
      };
    } catch (error) {
      log.error("Error calculating post aggregate PSV", { error, postId });
      throw error;
    }
  }

  /**
   * Find points with similar stances (potential consensus builders)
   */
  async findSimilarStances(pointId, threshold = 0.7) {
    try {
      const targetPSV = await this.getPointPSV(pointId);

      if (!targetPSV) {
        return {
          success: false,
          message: "Target point does not have stance vectors"
        };
      }

      // Get the point to find its post
      const point = await models.Point.findByPk(pointId);

      if (!point) {
        return {
          success: false,
          message: "Point not found"
        };
      }

      // Get all other points in the same post with stance vectors
      const otherPoints = await models.Point.findAll({
        where: {
          post_id: point.post_id,
          deleted: false,
          status: 'published',
          id: { [models.Sequelize.Op.ne]: pointId }
        },
        attributes: ['id']
      });

      const similarities = [];

      for (const otherPoint of otherPoints) {
        const analysis = await this.analyzeAgreement(pointId, otherPoint.id);

        if (analysis.success && analysis.overallSimilarity >= threshold) {
          similarities.push({
            pointId: otherPoint.id,
            similarity: analysis.overallSimilarity,
            agreement: analysis.overallAgreement,
            commonGround: analysis.commonGround
          });
        }
      }

      // Sort by similarity (highest first)
      similarities.sort((a, b) => b.similarity - a.similarity);

      return {
        success: true,
        targetPointId: pointId,
        similarPoints: similarities,
        threshold
      };
    } catch (error) {
      log.error("Error finding similar stances", { error, pointId });
      throw error;
    }
  }

  /**
   * Identify polarization in a deliberation
   */
  async analyzePolarization(postId) {
    try {
      const aggregate = await this.calculatePostAggregatePSV(postId);

      if (!aggregate.success) {
        return aggregate;
      }

      // High polarization = high standard deviation
      const polarizedDimensions = aggregate.aggregateStances.filter(
        d => d.consensus === "low"
      );

      const consensusDimensions = aggregate.aggregateStances.filter(
        d => d.consensus === "high"
      );

      return {
        success: true,
        postId,
        overallPolarization:
          polarizedDimensions.length > consensusDimensions.length ? "high" : "low",
        polarizedDimensions: polarizedDimensions.map(d => ({
          dimension: d.dimensionName,
          standardDeviation: d.standardDeviation
        })),
        consensusDimensions: consensusDimensions.map(d => ({
          dimension: d.dimensionName,
          averageStance: d.averageStance,
          standardDeviation: d.standardDeviation
        })),
        recommendations: this.generateRecommendations(
          polarizedDimensions,
          consensusDimensions
        )
      };
    } catch (error) {
      log.error("Error analyzing polarization", { error, postId });
      throw error;
    }
  }

  /**
   * Generate recommendations based on polarization analysis
   */
  generateRecommendations(polarizedDimensions, consensusDimensions) {
    const recommendations = [];

    if (consensusDimensions.length > 0) {
      recommendations.push({
        type: "common_ground",
        message: `Build on agreement in: ${consensusDimensions.map(d => d.dimensionName).join(", ")}`
      });
    }

    if (polarizedDimensions.length > 0) {
      recommendations.push({
        type: "bridge_building",
        message: `Focus dialogue on understanding differences in: ${polarizedDimensions.map(d => d.dimensionName).join(", ")}`
      });
    }

    return recommendations;
  }
}

module.exports = new ConsensusAnalyzer();

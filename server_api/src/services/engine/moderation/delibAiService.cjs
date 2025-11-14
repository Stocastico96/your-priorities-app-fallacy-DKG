const models = require("../../../models/index.cjs");
const log = require("../../../utils/logger.cjs");
const fallacyEducator = require("./fallacyEducator.cjs");

/**
 * DelibAI Service for Fallacy Detection
 * Integrates with fallacy detection models and provides educational feedback
 * Based on Jin et al. [24] - "Bridging Democratic Discourse"
 */

/**
 * Mock fallacy detection for now - replace with actual ML model API call
 * In production, this would call a trained transformer model
 */
async function detectFallacies(text, language = "en") {
  try {
    log.info("Detecting fallacies", { textLength: text.length, language });

    // TODO: Replace with actual ML model API call
    // For now, using simple keyword-based detection for demonstration
    const detections = mockFallacyDetection(text);

    log.info("Fallacy detection completed", {
      detectionsCount: detections.length
    });

    return detections;
  } catch (error) {
    log.error("Error in fallacy detection", { error });
    throw error;
  }
}

/**
 * Mock fallacy detection - Replace with real ML model
 * This is a placeholder for the actual fallacy detection service
 */
function mockFallacyDetection(text) {
  const detections = [];
  const lowerText = text.toLowerCase();

  // Simple keyword matching (replace with ML model)
  const patterns = {
    ad_hominem: /\b(you('re| are) (stupid|idiot|ignorant|dumb)|attacking|personally)\b/i,
    ad_populum: /\b(everyone (knows|thinks|says|agrees)|everybody|most people believe)\b/i,
    false_causality: /\b(therefore|thus|so|because of this|as a result)\b/i,
    straw_man: /\b(you('re| are) saying|you think|your position is)\b/i,
    false_dilemma: /\b(either .+ or|must (choose|pick|select) between|only two (options|choices))\b/i,
    appeal_to_authority: /\b(expert(s)? say|according to|famous .+ said)\b/i,
    slippery_slope: /\b(if .+ then .+ will|leads? to|result in|chain of events)\b/i,
    hasty_generalization: /\b(all .+ are|every .+ is|always|never)\b/i,
    red_herring: /\b(but what about|however|instead|rather than)\b/i,
    tu_quoque: /\b(you (do|did) (it|that) too|what about you|hypocrite)\b/i,
    circular_reasoning: /\b(because it (is|does)|obviously|clearly true)\b/i,
    no_true_scotsman: /\b(no (true|real)|not a (real|genuine))\b/i,
    burden_of_proof: /\b(prove (me|it) wrong|show me evidence|can you prove)\b/i
  };

  // Check for patterns (this is very simplistic - replace with ML)
  for (const [fallacyType, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      // Simulate confidence score (ML model would provide this)
      const confidence = 0.65 + Math.random() * 0.25; // 0.65-0.90

      detections.push({
        fallacyType,
        confidence,
        textSpan: text.substring(0, Math.min(100, text.length)),
        startChar: 0,
        endChar: Math.min(100, text.length)
      });
    }
  }

  return detections;
}

/**
 * Analyze a comment for fallacies and generate educational feedback
 *
 * @param {string} commentText - The comment text to analyze
 * @param {number} commentId - The Point/Comment ID
 * @param {object} options - Additional options (language, userId, etc.)
 * @returns {Promise<object>} Analysis results with educational feedback
 */
async function analyzeFallaciesInComment(commentText, commentId, options = {}) {
  try {
    const language = options.language || "en";
    const userId = options.userId;

    log.info("Analyzing comment for fallacies", {
      commentId,
      textLength: commentText.length,
      language
    });

    // Step 1: Detect fallacies
    const detections = await detectFallacies(commentText, language);

    if (detections.length === 0) {
      log.info("No fallacies detected", { commentId });
      return {
        commentId,
        fallaciesDetected: false,
        count: 0,
        detections: []
      };
    }

    // Step 2: Generate educational feedback for each detection
    const detectionsWithEducation = detections.map(detection => {
      const educationalFeedback = fallacyEducator.generateEducationalFeedback(
        detection.fallacyType,
        commentText,
        detection.confidence
      );

      return {
        ...detection,
        educationalFeedback
      };
    });

    // Step 3: Store in database if commentId provided
    if (commentId && options.storeInDatabase !== false) {
      await storeFallacyDetections(commentId, detectionsWithEducation, userId);
    }

    const result = {
      commentId,
      fallaciesDetected: true,
      count: detectionsWithEducation.length,
      detections: detectionsWithEducation,
      analyzedAt: new Date().toISOString()
    };

    log.info("Fallacy analysis completed", {
      commentId,
      fallaciesFound: detectionsWithEducation.length
    });

    return result;
  } catch (error) {
    log.error("Error analyzing comment for fallacies", {
      error,
      commentId
    });
    throw error;
  }
}

/**
 * Store fallacy detections in the database
 * Creates or updates records in comment_fallacy_labels table
 */
async function storeFallacyDetections(commentId, detections, userId = null) {
  try {
    // Ensure comment_fallacy_labels model exists
    if (!models.CommentFallacyLabel) {
      log.warn("CommentFallacyLabel model not found, skipping database storage");
      return;
    }

    const records = [];

    for (const detection of detections) {
      const record = await models.CommentFallacyLabel.create({
        point_id: commentId,
        fallacy_type: detection.fallacyType,
        confidence_score: detection.confidence,
        text_span: detection.textSpan,
        start_char: detection.startChar,
        end_char: detection.endChar,
        educational_feedback: detection.educationalFeedback,
        detected_at: new Date(),
        detection_model_version: "delib-ai-v1.0",
        user_id: userId,
        user_feedback_helpful: null, // Will be set when user provides feedback
        validation_status: "pending" // pending, validated, disputed
      });

      records.push(record);
    }

    log.info("Stored fallacy detections", {
      commentId,
      recordsCreated: records.length
    });

    return records;
  } catch (error) {
    log.error("Error storing fallacy detections", { error, commentId });
    // Don't throw - storage failure shouldn't break the analysis
    return [];
  }
}

/**
 * Get fallacy detections for a specific comment
 */
async function getFallacyDetectionsForComment(commentId) {
  try {
    if (!models.CommentFallacyLabel) {
      return [];
    }

    const detections = await models.CommentFallacyLabel.findAll({
      where: {
        point_id: commentId
      },
      order: [["confidence_score", "DESC"]]
    });

    return detections;
  } catch (error) {
    log.error("Error fetching fallacy detections", { error, commentId });
    return [];
  }
}

/**
 * Record user feedback on fallacy detection helpfulness
 */
async function recordUserFeedback(detectionId, isHelpful, userId = null) {
  try {
    if (!models.CommentFallacyLabel) {
      log.warn("CommentFallacyLabel model not found");
      return false;
    }

    const detection = await models.CommentFallacyLabel.findByPk(detectionId);

    if (!detection) {
      log.warn("Detection not found", { detectionId });
      return false;
    }

    detection.user_feedback_helpful = isHelpful;
    detection.feedback_user_id = userId;
    detection.feedback_at = new Date();

    await detection.save();

    log.info("Recorded user feedback", {
      detectionId,
      isHelpful,
      userId
    });

    return true;
  } catch (error) {
    log.error("Error recording user feedback", { error, detectionId });
    return false;
  }
}

/**
 * Update validation status of a fallacy detection
 */
async function updateValidationStatus(detectionId, status, userId = null) {
  try {
    if (!models.CommentFallacyLabel) {
      return false;
    }

    const validStatuses = ["pending", "validated", "disputed", "false_positive"];

    if (!validStatuses.includes(status)) {
      log.warn("Invalid validation status", { status });
      return false;
    }

    const detection = await models.CommentFallacyLabel.findByPk(detectionId);

    if (!detection) {
      return false;
    }

    detection.validation_status = status;
    detection.validated_by_user_id = userId;
    detection.validated_at = new Date();

    await detection.save();

    log.info("Updated validation status", {
      detectionId,
      status,
      userId
    });

    return true;
  } catch (error) {
    log.error("Error updating validation status", { error, detectionId });
    return false;
  }
}

/**
 * Get statistics on fallacy detections
 */
async function getFallacyStatistics(options = {}) {
  try {
    if (!models.CommentFallacyLabel) {
      return null;
    }

    const where = {};

    if (options.groupId) {
      // Would need to join with Point to filter by group
      // Simplified for now
    }

    if (options.startDate) {
      where.detected_at = {
        [models.Sequelize.Op.gte]: options.startDate
      };
    }

    const stats = await models.CommentFallacyLabel.findAll({
      attributes: [
        "fallacy_type",
        [models.Sequelize.fn("COUNT", models.Sequelize.col("id")), "count"],
        [
          models.Sequelize.fn("AVG", models.Sequelize.col("confidence_score")),
          "avg_confidence"
        ]
      ],
      where,
      group: ["fallacy_type"],
      raw: true
    });

    return stats;
  } catch (error) {
    log.error("Error getting fallacy statistics", { error });
    return null;
  }
}

module.exports = {
  analyzeFallaciesInComment,
  detectFallacies,
  getFallacyDetectionsForComment,
  recordUserFeedback,
  updateValidationStatus,
  getFallacyStatistics,
  storeFallacyDetections
};

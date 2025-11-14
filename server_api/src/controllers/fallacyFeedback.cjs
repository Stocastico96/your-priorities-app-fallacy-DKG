var express = require('express');
var router = express.Router();
var models = require("../models/index.cjs");
var auth = require('../authorization.cjs');
var log = require('../utils/logger.cjs');
var toJson = require('../utils/to_json.cjs');
var async = require('async');
var _ = require('lodash');
var queue = require('../services/workers/queue.cjs');
var fallacyExporter = require('../utils/exportFallacyFeedback.cjs');

/**
 * POST /api/fallacy-feedback
 * Create new feedback on a fallacy detection
 *
 * Body:
 * - fallacyLabelId: ID of the fallacy label
 * - feedbackType: 'correct' | 'false_positive' | 'wrong_type' | 'missed_fallacy'
 * - suggestedFallacyType: (optional) if feedbackType is 'wrong_type'
 * - explanation: (optional) text explanation
 * - confidence: (optional) 1-10 scale
 */
router.post('/', auth.isLoggedIn, async (req, res) => {
  try {
    const { fallacyLabelId, feedbackType, suggestedFallacyType, explanation, confidence } = req.body;

    // Validate required fields
    if (!fallacyLabelId || !feedbackType) {
      return res.status(400).json({
        error: 'Missing required fields: fallacyLabelId and feedbackType are required'
      });
    }

    // Validate feedbackType
    const validFeedbackTypes = ['correct', 'false_positive', 'wrong_type', 'missed_fallacy'];
    if (!validFeedbackTypes.includes(feedbackType)) {
      return res.status(400).json({
        error: `Invalid feedbackType. Must be one of: ${validFeedbackTypes.join(', ')}`
      });
    }

    // Validate suggestedFallacyType if feedbackType is 'wrong_type'
    if (feedbackType === 'wrong_type' && !suggestedFallacyType) {
      return res.status(400).json({
        error: 'suggestedFallacyType is required when feedbackType is wrong_type'
      });
    }

    // Check if fallacy label exists
    const fallacyLabel = await models.CommentFallacyLabel.findOne({
      where: { id: fallacyLabelId },
      include: [
        {
          model: models.Point,
          attributes: ['id', 'post_id', 'group_id']
        }
      ]
    });

    if (!fallacyLabel) {
      return res.status(404).json({ error: 'Fallacy label not found' });
    }

    // Check if user already provided feedback on this fallacy
    const existingFeedback = await models.FallacyFeedback.findOne({
      where: {
        fallacy_label_id: fallacyLabelId,
        user_id: req.user.id
      }
    });

    if (existingFeedback) {
      return res.status(409).json({
        error: 'You have already provided feedback on this fallacy detection',
        existingFeedback: toJson(existingFeedback)
      });
    }

    // Create feedback
    const feedback = await models.FallacyFeedback.create({
      fallacy_label_id: fallacyLabelId,
      user_id: req.user.id,
      feedback_type: feedbackType,
      suggested_fallacy_type: suggestedFallacyType || null,
      explanation: explanation || null,
      confidence: confidence || 5,
      ip_address: req.clientIp,
      user_agent: req.useragent.source,
      data: {
        point_id: fallacyLabel.Point.id,
        post_id: fallacyLabel.Point.post_id,
        timestamp: new Date().toISOString()
      }
    });

    log.info('Fallacy Feedback Created', {
      feedbackId: feedback.id,
      userId: req.user.id,
      fallacyLabelId: fallacyLabelId,
      feedbackType: feedbackType
    });

    // Update fallacy label status based on feedback
    await updateFallacyLabelStatus(fallacyLabel);

    // Create activity
    if (fallacyLabel.Point && fallacyLabel.Point.group_id) {
      models.AcActivity.createActivity({
        type: 'activity.fallacy.feedback.new',
        userId: req.user.id,
        groupId: fallacyLabel.Point.group_id,
        pointId: fallacyLabel.Point.id,
        postId: fallacyLabel.Point.post_id,
        access: models.AcActivity.ACCESS_PRIVATE
      }, (error) => {
        if (error) {
          log.error("Error creating activity for fallacy feedback", { error });
        }
      });
    }

    res.json({
      success: true,
      feedback: toJson(feedback)
    });

  } catch (error) {
    log.error("Error creating fallacy feedback", {
      error: error,
      stack: error.stack,
      userId: req.user ? req.user.id : null
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fallacy-feedback/stats/:fallacyLabelId
 * Get aggregated feedback statistics for a fallacy label
 */
router.get('/stats/:fallacyLabelId', async (req, res) => {
  try {
    const fallacyLabelId = req.params.fallacyLabelId;

    const fallacyLabel = await models.CommentFallacyLabel.findByPk(fallacyLabelId);
    if (!fallacyLabel) {
      return res.status(404).json({ error: 'Fallacy label not found' });
    }

    const stats = await models.FallacyFeedback.getAggregatedStats(fallacyLabelId);

    res.json({
      success: true,
      fallacyLabelId: fallacyLabelId,
      stats: stats
    });

  } catch (error) {
    log.error("Error getting fallacy feedback stats", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fallacy-feedback/controversial
 * Get fallacies with high dispute rate (>30% negative feedback)
 * Query params:
 * - limit: number of results (default 50)
 * - offset: pagination offset
 * - minFeedbacks: minimum number of feedbacks required (default 3)
 */
router.get('/controversial', auth.isLoggedIn, auth.hasModerationAccess, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const minFeedbacks = parseInt(req.query.minFeedbacks) || 3;

    // Get all fallacy labels with their feedbacks
    const fallacyLabels = await models.CommentFallacyLabel.findAll({
      include: [
        {
          model: models.FallacyFeedback,
          as: 'Feedbacks',
          attributes: ['id', 'feedback_type', 'created_at']
        },
        {
          model: models.Point,
          attributes: ['id', 'content', 'value', 'post_id'],
          include: [
            {
              model: models.User,
              attributes: ['id', 'name', 'email']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Filter and calculate stats
    const controversialFallacies = [];
    for (const label of fallacyLabels) {
      const feedbacks = label.Feedbacks || [];

      if (feedbacks.length < minFeedbacks) {
        continue;
      }

      const stats = {
        total: feedbacks.length,
        correct: 0,
        false_positive: 0,
        wrong_type: 0,
        missed_fallacy: 0
      };

      feedbacks.forEach(feedback => {
        stats[feedback.feedback_type]++;
      });

      const negativePercentage = ((stats.false_positive + stats.wrong_type) / stats.total) * 100;

      if (negativePercentage > 30) {
        controversialFallacies.push({
          fallacyLabel: toJson(label),
          point: toJson(label.Point),
          feedbackStats: {
            ...stats,
            positive_percentage: (stats.correct / stats.total) * 100,
            negative_percentage: negativePercentage,
            dispute_rate: negativePercentage
          }
        });
      }
    }

    // Sort by dispute rate (highest first)
    controversialFallacies.sort((a, b) =>
      b.feedbackStats.dispute_rate - a.feedbackStats.dispute_rate
    );

    // Paginate
    const paginatedResults = controversialFallacies.slice(offset, offset + limit);

    res.json({
      success: true,
      total: controversialFallacies.length,
      limit: limit,
      offset: offset,
      controversialFallacies: paginatedResults
    });

  } catch (error) {
    log.error("Error getting controversial fallacies", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fallacy-feedback/point/:pointId
 * Get all fallacy labels and their feedback for a specific point
 */
router.get('/point/:pointId', async (req, res) => {
  try {
    const pointId = req.params.pointId;

    const fallacyLabels = await models.CommentFallacyLabel.findAll({
      where: { point_id: pointId },
      include: [
        {
          model: models.FallacyFeedback,
          as: 'Feedbacks',
          attributes: ['id', 'feedback_type', 'suggested_fallacy_type', 'explanation', 'confidence', 'created_at'],
          include: [
            {
              model: models.User,
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Calculate stats for each label
    const results = await Promise.all(fallacyLabels.map(async (label) => {
      const stats = await models.FallacyFeedback.getAggregatedStats(label.id);
      return {
        fallacyLabel: toJson(label),
        stats: stats
      };
    }));

    res.json({
      success: true,
      pointId: pointId,
      fallacyLabels: results
    });

  } catch (error) {
    log.error("Error getting fallacy feedback for point", {
      error: error,
      stack: error.stack,
      pointId: req.params.pointId
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/fallacy-feedback/:id
 * Update existing feedback (user can update their own feedback)
 */
router.put('/:id', auth.isLoggedIn, async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const { feedbackType, suggestedFallacyType, explanation, confidence } = req.body;

    const feedback = await models.FallacyFeedback.findByPk(feedbackId);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Check if user owns this feedback
    if (feedback.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own feedback' });
    }

    // Update fields
    if (feedbackType) feedback.feedback_type = feedbackType;
    if (suggestedFallacyType) feedback.suggested_fallacy_type = suggestedFallacyType;
    if (explanation !== undefined) feedback.explanation = explanation;
    if (confidence) feedback.confidence = confidence;

    await feedback.save();

    log.info('Fallacy Feedback Updated', {
      feedbackId: feedback.id,
      userId: req.user.id
    });

    res.json({
      success: true,
      feedback: toJson(feedback)
    });

  } catch (error) {
    log.error("Error updating fallacy feedback", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/fallacy-feedback/:id
 * Delete feedback (soft delete)
 */
router.delete('/:id', auth.isLoggedIn, async (req, res) => {
  try {
    const feedbackId = req.params.id;

    const feedback = await models.FallacyFeedback.findByPk(feedbackId);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Check if user owns this feedback or is moderator
    const isModerator = await auth.hasModerationAccess(req, res, () => {});
    if (feedback.user_id !== req.user.id && !isModerator) {
      return res.status(403).json({ error: 'You can only delete your own feedback' });
    }

    feedback.deleted = true;
    await feedback.save();

    log.info('Fallacy Feedback Deleted', {
      feedbackId: feedback.id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    log.error("Error deleting fallacy feedback", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/fallacy-feedback/:id/override
 * Moderator override of a fallacy detection
 */
router.post('/:fallacyLabelId/override', auth.isLoggedIn, auth.hasModerationAccess, async (req, res) => {
  try {
    const fallacyLabelId = req.params.fallacyLabelId;
    const { status, notes } = req.body;

    const fallacyLabel = await models.CommentFallacyLabel.findByPk(fallacyLabelId);
    if (!fallacyLabel) {
      return res.status(404).json({ error: 'Fallacy label not found' });
    }

    fallacyLabel.moderator_override = true;
    fallacyLabel.moderator_user_id = req.user.id;
    fallacyLabel.moderator_notes = notes || '';
    if (status) {
      fallacyLabel.status = status; // 'overridden', 'validated', etc.
    }

    await fallacyLabel.save();

    log.info('Fallacy Label Overridden by Moderator', {
      fallacyLabelId: fallacyLabel.id,
      moderatorId: req.user.id,
      newStatus: fallacyLabel.status
    });

    res.json({
      success: true,
      fallacyLabel: toJson(fallacyLabel)
    });

  } catch (error) {
    log.error("Error overriding fallacy label", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fallacy-feedback/export
 * Export fallacy feedback data as CSV
 * Query params:
 * - format: 'csv' | 'json' | 'ml' (default: 'csv')
 */
router.get('/export', auth.isLoggedIn, auth.hasModerationAccess, async (req, res) => {
  try {
    const format = req.query.format || 'csv';

    log.info('Fallacy feedback export requested', {
      userId: req.user.id,
      format: format
    });

    if (format === 'csv') {
      // Stream CSV data directly
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fallacy-feedback-export-${new Date().toISOString()}.csv"`);

      const data = await fallacyExporter.getAllFeedbackData();
      const rows = [];

      // CSV Header
      rows.push([
        'fallacy_label_id',
        'point_id',
        'comment_text',
        'detected_fallacy',
        'ai_confidence',
        'ai_explanation',
        'ai_suggestion',
        'model_version',
        'status',
        'moderator_override',
        'total_feedbacks',
        'correct_votes',
        'false_positive_votes',
        'wrong_type_votes',
        'consensus',
        'consensus_score',
        'positive_rate',
        'negative_rate',
        'created_at'
      ].join(','));

      // Data rows
      for (const label of data) {
        const consensus = fallacyExporter.calculateConsensus(label.Feedbacks);
        const row = [
          label.id,
          label.point_id,
          fallacyExporter.escapeCSV(label.Point?.content || ''),
          label.fallacy_type,
          label.confidence_score,
          fallacyExporter.escapeCSV(label.ai_explanation || ''),
          fallacyExporter.escapeCSV(label.ai_suggestion || ''),
          label.model_version || '',
          label.status,
          label.moderator_override,
          consensus.total_feedbacks,
          consensus.correct_count,
          consensus.false_positive_count,
          consensus.wrong_type_count,
          consensus.consensus,
          consensus.consensus_score,
          consensus.positive_rate,
          consensus.negative_rate,
          label.created_at
        ].join(',');
        rows.push(row);
      }

      res.send(rows.join('\n'));

    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="fallacy-feedback-export-${new Date().toISOString()}.json"`);

      const data = await fallacyExporter.getAllFeedbackData();
      const exportData = [];

      for (const label of data) {
        const consensus = fallacyExporter.calculateConsensus(label.Feedbacks);
        exportData.push({
          fallacy_label_id: label.id,
          point_id: label.point_id,
          comment_text: label.Point?.content || '',
          detected_fallacy: label.fallacy_type,
          ai_confidence: label.confidence_score,
          ai_explanation: label.ai_explanation,
          ai_suggestion: label.ai_suggestion,
          feedback: consensus,
          created_at: label.created_at
        });
      }

      res.json(exportData);

    } else if (format === 'ml') {
      res.setHeader('Content-Type', 'application/x-jsonlines');
      res.setHeader('Content-Disposition', `attachment; filename="fallacy-feedback-ml-${new Date().toISOString()}.jsonl"`);

      const data = await fallacyExporter.getAllFeedbackData();
      const trainingExamples = [];

      for (const label of data) {
        const consensus = fallacyExporter.calculateConsensus(label.Feedbacks);
        if (consensus.total_feedbacks >= 3) {
          const example = {
            text: label.Point?.content || '',
            detected_fallacy: label.fallacy_type,
            ai_confidence: label.confidence_score,
            community_consensus: consensus.consensus,
            consensus_score: consensus.consensus_score,
            is_true_positive: consensus.consensus === 'confirmed',
            is_false_positive: consensus.consensus === 'rejected',
            feedback_count: consensus.total_feedbacks
          };
          trainingExamples.push(JSON.stringify(example));
        }
      }

      res.send(trainingExamples.join('\n'));

    } else {
      res.status(400).json({ error: 'Invalid format. Must be csv, json, or ml' });
    }

  } catch (error) {
    log.error("Error exporting fallacy feedback", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/fallacy-feedback/statistics
 * Get overall statistics about fallacy feedback
 */
router.get('/statistics', auth.isLoggedIn, auth.hasModerationAccess, async (req, res) => {
  try {
    const stats = await fallacyExporter.generateStatistics();

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    log.error("Error generating fallacy feedback statistics", {
      error: error,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update fallacy label status based on feedback
async function updateFallacyLabelStatus(fallacyLabel) {
  try {
    const stats = await models.FallacyFeedback.getAggregatedStats(fallacyLabel.id);

    // Don't change status if moderator has overridden
    if (fallacyLabel.moderator_override) {
      return;
    }

    // Update status based on feedback
    if (stats.total >= 3) {
      if (stats.positive_percentage >= 70) {
        fallacyLabel.status = 'validated';
      } else if (stats.negative_percentage >= 50) {
        fallacyLabel.status = 'disputed';
      }
      await fallacyLabel.save();
    }
  } catch (error) {
    log.error("Error updating fallacy label status", { error });
  }
}

module.exports = router;

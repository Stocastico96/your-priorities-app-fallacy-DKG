const express = require('express');
const router = express.Router();
const delibAIService = require('../services/delibAI.cjs');
const axios = require('axios');

// DKG configuration
const DKG_BASE_URL = process.env.DKG_BASE_URL || 'http://localhost:8085';

/**
 * Send fallacy analysis to Deliberation Knowledge Graph
 */
async function sendToDKG(pointId, text, analysis) {
  try {
    const fallacies = analysis.labels.map((label, index) => ({
      type: label,
      score: analysis.scores[index],
      rationale: analysis.advice // Use advice as rationale
    }));

    const payload = {
      contribution_id: `point-${pointId}`,
      text: text,
      fallacies: fallacies,
      timestamp: new Date().toISOString()
    };

    console.log(`Sending fallacy data to DKG: ${DKG_BASE_URL}/api/ingest/fallacy`);

    const response = await axios.post(
      `${DKG_BASE_URL}/api/ingest/fallacy`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );

    console.log(`DKG ingest success: ${response.data.fallacies_added} fallacies added, ${response.data.total_triples} total triples`);
    return response.data;
  } catch (error) {
    // Log error but don't fail the main request
    console.error('Failed to send to DKG:', error.message);
    if (error.response) {
      console.error('DKG response:', error.response.status, error.response.data);
    }
    return null;
  }
}

// Analyze a point for fallacies
router.post('/analyze-point', async (req, res) => {
  try {
    const { text, pointId, contentType = 'point' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Analyze with DelibAI
    const analysis = await delibAIService.analyzeFallacies(text);

    // Save to database if pointId provided
    if (pointId) {
      const { CommentFallacyLabel } = req.app.get('models');

      await CommentFallacyLabel.create({
        content_type: contentType,
        content_id: pointId,
        labels: analysis.labels,
        scores: analysis.scores,
        advice: analysis.advice,
        rewrite: analysis.rewrite,
        model: analysis.model,
        provider: analysis.provider,
        latency_ms: analysis.latency_ms
      });

      // Send to DKG (non-blocking - errors are logged but don't fail the request)
      if (analysis.labels && analysis.labels.length > 0) {
        sendToDKG(pointId, text, analysis).catch(err => {
          console.error('DKG send failed:', err.message);
        });
      }
    }

    res.json(analysis);
  } catch (error) {
    console.error('DelibAI analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get fallacy analysis for a point
router.get('/point/:pointId/fallacies', async (req, res) => {
  try {
    const { pointId } = req.params;
    const { CommentFallacyLabel } = req.app.get('models');

    const analysis = await CommentFallacyLabel.findOne({
      where: {
        content_type: 'point',
        content_id: pointId
      },
      order: [['created_at', 'DESC']]
    });

    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Get fallacies error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a comment about a fallacy
router.post('/point/:pointId/fallacy-comment', async (req, res) => {
  try {
    const { pointId } = req.params;
    const { fallacyLabel, comment } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!fallacyLabel || !comment) {
      return res.status(400).json({ error: 'Fallacy label and comment are required' });
    }

    const { FallacyComment } = req.app.get('models');

    const fallacyComment = await FallacyComment.create({
      point_id: pointId,
      fallacy_label: fallacyLabel,
      user_id: userId,
      comment: comment
    });

    res.json(fallacyComment);
  } catch (error) {
    console.error('Add fallacy comment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a fallacy
router.get('/point/:pointId/fallacy-comments', async (req, res) => {
  try {
    const { pointId } = req.params;
    const { FallacyComment, User } = req.app.get('models');

    const comments = await FallacyComment.findAll({
      where: { point_id: pointId },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['created_at', 'DESC']]
    });

    res.json(comments);
  } catch (error) {
    console.error('Get fallacy comments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DelibAI' });
});

module.exports = router;

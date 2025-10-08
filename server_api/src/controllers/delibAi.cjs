const express = require('express');
const router = express.Router();
const auth = require('../authorization.cjs');
const delibAiService = require('../services/moderation/delibAiService.cjs');
const models = require('../models/index.cjs');
const log = require('../utils/logger.cjs');

// Analyze draft content on-demand for UI previews (no auth required for logged-in users)
router.post('/analyze', async function (req, res) {
  try {
    const { text, type = 'draft' } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Missing or empty text' });
    }

    const analysis = await delibAiService.analyzeContent({
      text,
      userId: req.user && req.user.id ? req.user.id : null,
      type,
      entityId: null, // draft, not saved yet
      contentType: type === 'idea' ? 'idea' : 'comment',
    });

    res.json({
      fallacies: analysis?.delibResult?.fallacies || [],
      ontologyHints: analysis?.delibResult?.ontologyHints || null,
      rewrite: analysis?.delibResult?.rewrite || null,
      shouldBlock: analysis?.moderation?.decision === 'block',
    });
  } catch (error) {
    log.error('DelibAI on-demand analysis failed', { error });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Optional: simple event logger for banner interactions
router.post('/event', auth.can('view domain'), async function (req, res) {
  try {
    const { eventName, properties } = req.body || {};
    if (!eventName) return res.status(400).json({ error: 'Missing eventName' });
    await models.ModerationEvents.create({
      event_name: eventName,
      properties: properties || {},
    });
    res.json({ status: 'ok' });
  } catch (error) {
    log.error('DelibAI event log failed', { error });
    res.status(500).json({ error: 'Event log failed' });
  }
});

module.exports = router;


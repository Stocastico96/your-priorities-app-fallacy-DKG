var express = require("express");
var router = express.Router();
var models = require("../models/index.cjs");
var auth = require("../authorization.cjs");
var log = require("../utils/logger.cjs");
var toJson = require("../utils/to_json.cjs");

// Submit feedback on fallacy detection accuracy
router.post(
  "/:pointId/feedback",
  auth.isLoggedIn,
  async function (req, res) {
    try {
      const { pointId } = req.params;
      const { fallacyLabel, isHelpful } = req.body;
      const userId = req.user.id;

      if (!fallacyLabel || typeof isHelpful !== "boolean") {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify point exists
      const point = await models.Point.findByPk(pointId);
      if (!point) {
        return res.status(404).json({ error: "Point not found" });
      }

      // Upsert feedback (update if exists, insert if not)
      const [feedback, created] = await models.sequelize.query(
        `INSERT INTO fallacy_feedback (point_id, fallacy_label, user_id, is_helpful, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (point_id, fallacy_label, user_id)
         DO UPDATE SET is_helpful = $4, updated_at = NOW()
         RETURNING *`,
        {
          bind: [pointId, fallacyLabel, userId, isHelpful],
          type: models.sequelize.QueryTypes.SELECT,
        }
      );

      log.info("Fallacy feedback submitted", {
        pointId,
        fallacyLabel,
        userId,
        isHelpful,
        created,
      });

      res.json({ success: true, feedback: feedback[0] });
    } catch (error) {
      log.error("Error submitting fallacy feedback", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get feedback stats for a point's fallacies
router.get(
  "/:pointId/feedback",
  async function (req, res) {
    try {
      const { pointId } = req.params;

      const feedbackStats = await models.sequelize.query(
        `SELECT
          fallacy_label,
          COUNT(*) FILTER (WHERE is_helpful = true) as helpful_count,
          COUNT(*) FILTER (WHERE is_helpful = false) as not_helpful_count,
          COUNT(*) as total_count
         FROM fallacy_feedback
         WHERE point_id = $1
         GROUP BY fallacy_label`,
        {
          bind: [pointId],
          type: models.sequelize.QueryTypes.SELECT,
        }
      );

      // Get current user's feedback if logged in
      let userFeedback = {};
      if (req.user) {
        const userFeedbackRows = await models.sequelize.query(
          `SELECT fallacy_label, is_helpful
           FROM fallacy_feedback
           WHERE point_id = $1 AND user_id = $2`,
          {
            bind: [pointId, req.user.id],
            type: models.sequelize.QueryTypes.SELECT,
          }
        );
        userFeedback = userFeedbackRows.reduce((acc, row) => {
          acc[row.fallacy_label] = row.is_helpful;
          return acc;
        }, {});
      }

      res.json({ stats: feedbackStats, userFeedback });
    } catch (error) {
      log.error("Error fetching fallacy feedback", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Submit comment on a fallacy
router.post(
  "/:pointId/comments",
  auth.isLoggedIn,
  async function (req, res) {
    try {
      const { pointId } = req.params;
      const { fallacyLabel, comment } = req.body;
      const userId = req.user.id;

      if (!fallacyLabel || !comment) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify point exists
      const point = await models.Point.findByPk(pointId);
      if (!point) {
        return res.status(404).json({ error: "Point not found" });
      }

      const [result] = await models.sequelize.query(
        `INSERT INTO fallacy_comments (point_id, fallacy_label, user_id, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        {
          bind: [pointId, fallacyLabel, userId, comment],
          type: models.sequelize.QueryTypes.SELECT,
        }
      );

      log.info("Fallacy comment submitted", {
        pointId,
        fallacyLabel,
        userId,
      });

      res.json({ success: true, comment: result });
    } catch (error) {
      log.error("Error submitting fallacy comment", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get comments for a point's fallacies
router.get(
  "/:pointId/comments",
  async function (req, res) {
    try {
      const { pointId } = req.params;
      const { fallacyLabel } = req.query;

      let query = `
        SELECT fc.*, u.name as user_name, u.email as user_email
        FROM fallacy_comments fc
        JOIN users u ON fc.user_id = u.id
        WHERE fc.point_id = $1
      `;
      const bindings = [pointId];

      if (fallacyLabel) {
        query += ` AND fc.fallacy_label = $2`;
        bindings.push(fallacyLabel);
      }

      query += ` ORDER BY fc.created_at DESC`;

      const comments = await models.sequelize.query(query, {
        bind: bindings,
        type: models.sequelize.QueryTypes.SELECT,
      });

      res.json({ comments });
    } catch (error) {
      log.error("Error fetching fallacy comments", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get comment counts per fallacy for a point
router.get(
  "/:pointId/comment-counts",
  async function (req, res) {
    try {
      const { pointId } = req.params;

      const counts = await models.sequelize.query(
        `SELECT fallacy_label, COUNT(*) as count
         FROM fallacy_comments
         WHERE point_id = $1
         GROUP BY fallacy_label`,
        {
          bind: [pointId],
          type: models.sequelize.QueryTypes.SELECT,
        }
      );

      const countMap = counts.reduce((acc, row) => {
        acc[row.fallacy_label] = parseInt(row.count);
        return acc;
      }, {});

      res.json({ counts: countMap });
    } catch (error) {
      log.error("Error fetching fallacy comment counts", { error });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;

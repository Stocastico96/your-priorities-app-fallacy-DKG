var express = require("express");
var router = express.Router();
var models = require("../models/index.cjs");
var auth = require("../authorization.cjs");
var log = require("../utils/logger.cjs");
var toJson = require("../utils/to_json.cjs");
var queue = require("../services/workers/queue.cjs");

const perspectiveDimensions = require("../services/analysis/perspectiveDimensions.cjs");
const psvCalculator = require("../services/analysis/psvCalculator.cjs");
const consensusAnalyzer = require("../services/analysis/consensusAnalyzer.cjs");

/**
 * @api {get} /api/posts/:id/stance-analysis Get stance analysis for a post
 * @apiName GetPostStanceAnalysis
 * @apiGroup Analysis
 * @apiDescription Get aggregate stance analysis and distribution for all comments on a post
 */
router.get("/:id/stance-analysis", auth.can("view post"), async (req, res) => {
  try {
    const postId = req.params.id;

    // Get post to verify access
    const post = await models.Post.findOne({
      where: { id: postId },
      attributes: ["id", "name"],
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Get dimensions for this post
    const dimensions = await perspectiveDimensions.getDimensions(postId);

    // Get aggregate PSV
    const aggregate = await consensusAnalyzer.calculatePostAggregatePSV(postId);

    // Get polarization analysis
    const polarization = await consensusAnalyzer.analyzePolarization(postId);

    res.json({
      success: true,
      postId,
      postName: post.name,
      dimensions: dimensions.map(d => ({
        id: d.id,
        name: d.dimension_name,
        description: d.dimension_description,
        scaleNegative: d.scale_negative_label,
        scalePositive: d.scale_positive_label,
      })),
      aggregate,
      polarization,
    });
  } catch (error) {
    log.error("Error getting post stance analysis", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @api {get} /api/points/:id/stance-vector Get stance vector for a comment
 * @apiName GetCommentStanceVector
 * @apiGroup Analysis
 * @apiDescription Get the PSV for a specific comment
 */
router.get("/points/:id/stance-vector", auth.can("view point"), async (req, res) => {
  try {
    const pointId = req.params.id;

    // Verify point exists
    const point = await models.Point.findOne({
      where: { id: pointId },
      attributes: ["id", "content"],
    });

    if (!point) {
      return res.status(404).json({ error: "Point not found" });
    }

    // Get PSV
    const psv = await psvCalculator.getPSV(pointId);

    res.json({
      success: true,
      pointId,
      content: point.content,
      ...psv,
    });
  } catch (error) {
    log.error("Error getting point stance vector", {
      error: error.message,
      stack: error.stack,
      pointId: req.params.id,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @api {post} /api/analysis/compare-stances Compare stances between two comments
 * @apiName CompareStances
 * @apiGroup Analysis
 * @apiDescription Analyze agreement/disagreement between two comments
 */
router.post("/compare-stances", auth.isLoggedIn, async (req, res) => {
  try {
    const { pointId1, pointId2 } = req.body;

    if (!pointId1 || !pointId2) {
      return res.status(400).json({
        error: "Both pointId1 and pointId2 are required",
      });
    }

    // Verify both points exist
    const points = await models.Point.findAll({
      where: {
        id: [pointId1, pointId2],
      },
      attributes: ["id", "content", "user_id"],
    });

    if (points.length !== 2) {
      return res.status(404).json({
        error: "One or both points not found",
      });
    }

    // Perform agreement analysis
    const analysis = await consensusAnalyzer.analyzeAgreement(pointId1, pointId2);

    res.json(analysis);
  } catch (error) {
    log.error("Error comparing stances", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @api {post} /api/posts/:id/dimensions Create dimensions for a post
 * @apiName CreatePostDimensions
 * @apiGroup Analysis
 * @apiDescription Create dimensions for PSV analysis using a template
 */
router.post(
  "/:id/dimensions",
  auth.can("edit post"),
  async (req, res) => {
    try {
      const postId = req.params.id;
      const { template } = req.body;

      // Verify post exists
      const post = await models.Post.findOne({
        where: { id: postId },
        attributes: ["id", "name", "group_id"],
      });

      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Check if dimensions already exist
      const existingDimensions = await perspectiveDimensions.getDimensions(postId);
      if (existingDimensions.length > 0) {
        return res.status(400).json({
          error: "Dimensions already exist for this post",
          existingDimensions: existingDimensions.length,
        });
      }

      // Create dimensions from template
      const dimensions = await perspectiveDimensions.createFromTemplate(
        template || "general",
        postId,
        post.group_id
      );

      res.json({
        success: true,
        postId,
        dimensions: dimensions.map(d => ({
          id: d.id,
          name: d.dimension_name,
          description: d.dimension_description,
        })),
      });
    } catch (error) {
      log.error("Error creating post dimensions", {
        error: error.message,
        stack: error.stack,
        postId: req.params.id,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @api {get} /api/posts/:id/dimensions Get dimensions for a post
 * @apiName GetPostDimensions
 * @apiGroup Analysis
 * @apiDescription Get all active dimensions for a post
 */
router.get("/:id/dimensions", auth.can("view post"), async (req, res) => {
  try {
    const postId = req.params.id;

    const dimensions = await perspectiveDimensions.getDimensions(postId);

    res.json({
      success: true,
      postId,
      dimensions: dimensions.map(d => ({
        id: d.id,
        name: d.dimension_name,
        description: d.dimension_description,
        scaleNegative: d.scale_negative_label,
        scalePositive: d.scale_positive_label,
        position: d.position,
      })),
    });
  } catch (error) {
    log.error("Error getting post dimensions", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @api {post} /api/points/:id/calculate-psv Trigger PSV calculation for a point
 * @apiName CalculatePointPSV
 * @apiGroup Analysis
 * @apiDescription Manually trigger PSV calculation (normally done automatically)
 */
router.post(
  "/points/:id/calculate-psv",
  auth.can("add to post"),
  async (req, res) => {
    try {
      const pointId = req.params.id;

      // Verify point exists
      const point = await models.Point.findOne({
        where: { id: pointId },
        attributes: ["id"],
      });

      if (!point) {
        return res.status(404).json({ error: "Point not found" });
      }

      // Queue PSV calculation job
      queue.add(
        "process-psv-calculation",
        { type: "calculate-psv", pointId },
        "high"
      );

      res.json({
        success: true,
        message: "PSV calculation queued",
        pointId,
      });
    } catch (error) {
      log.error("Error queueing PSV calculation", {
        error: error.message,
        stack: error.stack,
        pointId: req.params.id,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @api {get} /api/points/:id/similar-stances Find points with similar stances
 * @apiName FindSimilarStances
 * @apiGroup Analysis
 * @apiDescription Find other comments with similar stance vectors
 */
router.get(
  "/points/:id/similar-stances",
  auth.can("view point"),
  async (req, res) => {
    try {
      const pointId = req.params.id;
      const threshold = parseFloat(req.query.threshold) || 0.7;

      const similarStances = await consensusAnalyzer.findSimilarStances(
        pointId,
        threshold
      );

      res.json(similarStances);
    } catch (error) {
      log.error("Error finding similar stances", {
        error: error.message,
        stack: error.stack,
        pointId: req.params.id,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * @api {get} /api/analysis/dimension-templates Get available dimension templates
 * @apiName GetDimensionTemplates
 * @apiGroup Analysis
 * @apiDescription Get list of available dimension templates
 */
router.get("/dimension-templates", auth.isLoggedIn, async (req, res) => {
  try {
    const templates = perspectiveDimensions.getTemplates();

    res.json({
      success: true,
      templates: Object.keys(templates).map(key => ({
        name: key,
        dimensions: templates[key].map(d => d.dimension_name),
      })),
    });
  } catch (error) {
    log.error("Error getting dimension templates", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

"use strict";

/**
 * PSV Implementation Test and Example
 *
 * This file demonstrates the PSV system with sample comments
 * and generates performance metrics.
 *
 * To run this test:
 * 1. Ensure database is set up with migrations run
 * 2. Set OPENAI_API_KEY or OPENROUTER_API_KEY in environment
 * 3. Run: node server_api/src/services/analysis/psvExampleTest.cjs
 */

const models = require("../../models/index.cjs");
const perspectiveDimensions = require("./perspectiveDimensions.cjs");
const psvCalculator = require("./psvCalculator.cjs");
const consensusAnalyzer = require("./consensusAnalyzer.cjs");
const log = require("../../utils/logger.cjs");

// Sample comments on climate policy
const SAMPLE_COMMENTS = [
  {
    content: "We need immediate action on climate change. The science is clear and the costs of inaction far outweigh the investment needed. This is an economic opportunity for green jobs and innovation, not just an environmental issue.",
    expected_stance: {
      economic_impact: 0.7,
      environmental_urgency: 0.9,
      technological_feasibility: 0.6,
      social_equity: 0.5,
      international_cooperation: 0.8
    }
  },
  {
    content: "While climate change is real, we need to be practical about the economic impacts. Rushing into expensive policies could hurt working families and small businesses. We should focus on affordable, gradual transitions that don't destroy jobs.",
    expected_stance: {
      economic_impact: -0.6,
      environmental_urgency: 0.3,
      technological_feasibility: 0.2,
      social_equity: 0.4,
      international_cooperation: 0.0
    }
  },
  {
    content: "The technology exists today to make significant progress. Solar and wind are now cheaper than fossil fuels in many places. We just need the political will to invest in infrastructure and create incentives for adoption.",
    expected_stance: {
      economic_impact: 0.6,
      environmental_urgency: 0.5,
      technological_feasibility: 0.9,
      social_equity: 0.3,
      international_cooperation: 0.4
    }
  },
  {
    content: "Any climate policy must prioritize equity. Low-income communities and developing nations shouldn't bear the burden while wealthy polluters escape responsibility. We need a just transition with support for affected workers.",
    expected_stance: {
      economic_impact: 0.2,
      environmental_urgency: 0.6,
      technological_feasibility: 0.4,
      social_equity: 0.95,
      international_cooperation: 0.7
    }
  },
  {
    content: "This requires global cooperation. No single country can solve climate change alone. We need binding international agreements with enforcement mechanisms and financial support for developing nations.",
    expected_stance: {
      economic_impact: 0.3,
      environmental_urgency: 0.7,
      technological_feasibility: 0.5,
      social_equity: 0.6,
      international_cooperation: 0.95
    }
  }
];

class PSVExampleTest {
  constructor() {
    this.testResults = {
      setup: {},
      calculations: [],
      comparisons: [],
      aggregates: {},
      performanceMetrics: {}
    };
  }

  async initialize() {
    try {
      await models.sequelize.authenticate();
      log.info("Database connection established");
      return true;
    } catch (error) {
      log.error("Unable to connect to database", { error: error.message });
      return false;
    }
  }

  async setupTestData() {
    log.info("Setting up test data...");

    try {
      // Create a test group if it doesn't exist
      const [group] = await models.Group.findOrCreate({
        where: { name: "PSV Test Group" },
        defaults: {
          name: "PSV Test Group",
          access: models.Group.ACCESS_PUBLIC,
          user_agent: "test",
          ip_address: "127.0.0.1"
        }
      });

      // Create a test post
      const [post] = await models.Post.findOrCreate({
        where: {
          name: "Climate Policy Discussion - PSV Test"
        },
        defaults: {
          name: "Climate Policy Discussion - PSV Test",
          description: "Test deliberation for PSV system",
          content_type: models.Post.CONTENT_QUESTION,
          status: "published",
          group_id: group.id,
          user_agent: "test",
          ip_address: "127.0.0.1"
        }
      });

      // Create dimensions
      const existingDimensions = await perspectiveDimensions.getDimensions(post.id);

      if (existingDimensions.length === 0) {
        await perspectiveDimensions.createFromTemplate("climate_policy", post.id, group.id);
        log.info("Created climate policy dimensions");
      }

      // Create test user if doesn't exist
      const [user] = await models.User.findOrCreate({
        where: { email: "psv_test@example.com" },
        defaults: {
          name: "PSV Test User",
          email: "psv_test@example.com"
        }
      });

      // Create sample points (comments)
      const points = [];
      for (let i = 0; i < SAMPLE_COMMENTS.length; i++) {
        const comment = SAMPLE_COMMENTS[i];

        const [point] = await models.Point.findOrCreate({
          where: {
            content: comment.content,
            post_id: post.id
          },
          defaults: {
            content: comment.content,
            content_type: models.Point.CONTENT_COMMENT,
            status: "published",
            value: 0,
            post_id: post.id,
            group_id: group.id,
            user_id: user.id,
            user_agent: "test",
            ip_address: "127.0.0.1"
          }
        });

        points.push(point);
      }

      this.testResults.setup = {
        groupId: group.id,
        postId: post.id,
        userId: user.id,
        pointIds: points.map(p => p.id),
        dimensionsCount: (await perspectiveDimensions.getDimensions(post.id)).length
      };

      log.info("Test data setup complete", this.testResults.setup);
      return { post, points };
    } catch (error) {
      log.error("Error setting up test data", { error: error.message });
      throw error;
    }
  }

  async testPSVCalculation(points) {
    log.info("Testing PSV calculation...");

    const calculationResults = [];

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const startTime = Date.now();

      try {
        log.info(`Calculating PSV for point ${i + 1}/${points.length}...`);

        const result = await psvCalculator.calculatePSV(point.id);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        calculationResults.push({
          pointId: point.id,
          commentPreview: point.content.substring(0, 100) + "...",
          success: result.success,
          dimensionsAnalyzed: result.dimensions?.length || 0,
          totalTime,
          averageTimePerDimension: result.averageTimePerDimension,
          dimensions: result.dimensions?.map(d => ({
            name: d.dimension,
            stance: d.stance_value,
            confidence: d.confidence
          }))
        });

        log.info(`PSV calculated in ${totalTime}ms`, {
          pointId: point.id,
          dimensions: result.dimensions?.length
        });

      } catch (error) {
        log.error(`Error calculating PSV for point ${point.id}`, {
          error: error.message
        });

        calculationResults.push({
          pointId: point.id,
          success: false,
          error: error.message
        });
      }
    }

    this.testResults.calculations = calculationResults;

    // Calculate aggregate metrics
    const successfulCalculations = calculationResults.filter(r => r.success);
    const totalTimes = successfulCalculations.map(r => r.totalTime);

    this.testResults.performanceMetrics.calculation = {
      totalPoints: points.length,
      successfulCalculations: successfulCalculations.length,
      failedCalculations: points.length - successfulCalculations.length,
      averageTimeMs: totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length,
      minTimeMs: Math.min(...totalTimes),
      maxTimeMs: Math.max(...totalTimes)
    };

    log.info("PSV calculation complete", this.testResults.performanceMetrics.calculation);

    return successfulCalculations;
  }

  async testConsensusAnalysis(points) {
    log.info("Testing consensus analysis...");

    const comparisons = [];

    // Compare first comment with each other comment
    for (let i = 1; i < points.length; i++) {
      try {
        const startTime = Date.now();

        const analysis = await consensusAnalyzer.analyzeAgreement(
          points[0].id,
          points[i].id
        );

        const endTime = Date.now();

        if (analysis.success) {
          comparisons.push({
            point1Id: points[0].id,
            point2Id: points[i].id,
            overallSimilarity: analysis.overallSimilarity,
            overallAgreement: analysis.overallAgreement,
            commonGround: analysis.commonGround,
            pointsOfContention: analysis.pointsOfContention,
            processingTime: endTime - startTime
          });

          log.info(`Consensus analysis: ${analysis.overallAgreement}`, {
            similarity: analysis.overallSimilarity.toFixed(3),
            commonGround: analysis.commonGround.length,
            contention: analysis.pointsOfContention.length
          });
        }
      } catch (error) {
        log.error("Error in consensus analysis", { error: error.message });
      }
    }

    this.testResults.comparisons = comparisons;

    // Calculate aggregate metrics
    const processingTimes = comparisons.map(c => c.processingTime);

    this.testResults.performanceMetrics.consensus = {
      totalComparisons: comparisons.length,
      averageTimeMs: processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length,
      minTimeMs: Math.min(...processingTimes),
      maxTimeMs: Math.max(...processingTimes)
    };

    log.info("Consensus analysis complete", this.testResults.performanceMetrics.consensus);

    return comparisons;
  }

  async testAggregateAnalysis(postId) {
    log.info("Testing aggregate PSV analysis...");

    try {
      const startTime = Date.now();

      const aggregate = await consensusAnalyzer.calculatePostAggregatePSV(postId);
      const polarization = await consensusAnalyzer.analyzePolarization(postId);

      const endTime = Date.now();

      this.testResults.aggregates = {
        success: aggregate.success && polarization.success,
        aggregate: aggregate.success ? {
          dimensionsAnalyzed: aggregate.aggregateStances?.length,
          stances: aggregate.aggregateStances?.map(d => ({
            dimension: d.dimensionName,
            average: d.averageStance,
            consensus: d.consensus,
            stdDev: d.standardDeviation,
            sampleSize: d.sampleSize
          }))
        } : null,
        polarization: polarization.success ? {
          overall: polarization.overallPolarization,
          polarizedDimensions: polarization.polarizedDimensions?.length,
          consensusDimensions: polarization.consensusDimensions?.length,
          recommendations: polarization.recommendations
        } : null,
        processingTime: endTime - startTime
      };

      this.testResults.performanceMetrics.aggregate = {
        processingTimeMs: endTime - startTime
      };

      log.info("Aggregate analysis complete", this.testResults.performanceMetrics.aggregate);

    } catch (error) {
      log.error("Error in aggregate analysis", { error: error.message });
      this.testResults.aggregates = { success: false, error: error.message };
    }
  }

  printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("PSV IMPLEMENTATION TEST RESULTS");
    console.log("=".repeat(80) + "\n");

    console.log("SETUP:");
    console.log(JSON.stringify(this.testResults.setup, null, 2));

    console.log("\n" + "-".repeat(80));
    console.log("PERFORMANCE METRICS:");
    console.log("-".repeat(80));
    console.log(JSON.stringify(this.testResults.performanceMetrics, null, 2));

    console.log("\n" + "-".repeat(80));
    console.log("SAMPLE PSV CALCULATION (First Comment):");
    console.log("-".repeat(80));
    if (this.testResults.calculations.length > 0) {
      const first = this.testResults.calculations[0];
      console.log(`Comment: ${first.commentPreview}`);
      console.log(`Processing Time: ${first.totalTime}ms`);
      console.log("\nStance Vector:");
      first.dimensions?.forEach(d => {
        console.log(`  ${d.name}: ${d.stance.toFixed(3)} (confidence: ${d.confidence.toFixed(3)})`);
      });
    }

    console.log("\n" + "-".repeat(80));
    console.log("CONSENSUS ANALYSIS EXAMPLES:");
    console.log("-".repeat(80));
    this.testResults.comparisons.slice(0, 2).forEach((comp, idx) => {
      console.log(`\nComparison ${idx + 1}:`);
      console.log(`  Overall Agreement: ${comp.overallAgreement}`);
      console.log(`  Similarity Score: ${comp.overallSimilarity.toFixed(3)}`);
      console.log(`  Common Ground: ${comp.commonGround.join(", ") || "none"}`);
      console.log(`  Points of Contention: ${comp.pointsOfContention.join(", ") || "none"}`);
      console.log(`  Processing Time: ${comp.processingTime}ms`);
    });

    console.log("\n" + "-".repeat(80));
    console.log("AGGREGATE ANALYSIS:");
    console.log("-".repeat(80));
    if (this.testResults.aggregates.success) {
      console.log(`Dimensions Analyzed: ${this.testResults.aggregates.aggregate.dimensionsAnalyzed}`);
      console.log("\nCommunity Averages:");
      this.testResults.aggregates.aggregate.stances?.forEach(s => {
        console.log(`  ${s.dimension}: ${s.average.toFixed(3)} (consensus: ${s.consensus}, n=${s.sampleSize})`);
      });

      console.log(`\nOverall Polarization: ${this.testResults.aggregates.polarization.overall}`);
      console.log(`Polarized Dimensions: ${this.testResults.aggregates.polarization.polarizedDimensions}`);
      console.log(`Consensus Dimensions: ${this.testResults.aggregates.polarization.consensusDimensions}`);

      if (this.testResults.aggregates.polarization.recommendations) {
        console.log("\nRecommendations:");
        this.testResults.aggregates.polarization.recommendations.forEach(rec => {
          console.log(`  [${rec.type}] ${rec.message}`);
        });
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("TEST COMPLETE");
    console.log("=".repeat(80) + "\n");
  }

  async run() {
    console.log("Starting PSV Implementation Test...\n");

    const initialized = await this.initialize();
    if (!initialized) {
      console.error("Failed to initialize database connection");
      return;
    }

    try {
      const { post, points } = await this.setupTestData();

      await this.testPSVCalculation(points);

      await this.testConsensusAnalysis(points);

      await this.testAggregateAnalysis(post.id);

      this.printResults();

    } catch (error) {
      log.error("Test failed", { error: error.message, stack: error.stack });
      console.error("Test failed:", error.message);
    } finally {
      await models.sequelize.close();
    }
  }
}

// Run the test if executed directly
if (require.main === module) {
  const test = new PSVExampleTest();
  test.run().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = PSVExampleTest;

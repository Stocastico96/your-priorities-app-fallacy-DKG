"use strict";

const log = require('../../utils/logger.cjs');
const psvCalculator = require('../analysis/psvCalculator.cjs');

/**
 * Background worker for PSV calculation
 * Processes stance vector calculations asynchronously
 */
module.exports = {
  /**
   * Process a PSV calculation job
   * @param {Object} data - Job data containing pointId
   * @param {Function} done - Callback when job is complete
   */
  process: async function(data, done) {
    const { type, pointId } = data;

    try {
      log.info("PSV calculation job started", { type, pointId });

      switch (type) {
        case 'calculate-psv':
          await this.calculatePSV(pointId);
          break;

        case 'recalculate-psv':
          await this.recalculatePSV(pointId);
          break;

        default:
          log.error("Unknown PSV calculation job type", { type });
          return done(new Error(`Unknown job type: ${type}`));
      }

      log.info("PSV calculation job completed", { type, pointId });
      done();
    } catch (error) {
      log.error("PSV calculation job failed", {
        error: error.message,
        stack: error.stack,
        type,
        pointId
      });
      done(error);
    }
  },

  /**
   * Calculate PSV for a new comment
   */
  calculatePSV: async function(pointId) {
    try {
      const result = await psvCalculator.calculatePSV(pointId);

      if (!result.success) {
        log.warn("PSV calculation returned unsuccessful", {
          pointId,
          message: result.message
        });
        return;
      }

      log.info("Successfully calculated PSV", {
        pointId,
        dimensions: result.dimensions.length,
        totalTime: result.totalProcessingTimeMs
      });

      return result;
    } catch (error) {
      log.error("Error in calculatePSV worker", {
        error: error.message,
        pointId
      });
      throw error;
    }
  },

  /**
   * Recalculate PSV for an existing comment
   */
  recalculatePSV: async function(pointId) {
    try {
      const result = await psvCalculator.recalculatePSV(pointId);

      if (!result.success) {
        log.warn("PSV recalculation returned unsuccessful", {
          pointId,
          message: result.message
        });
        return;
      }

      log.info("Successfully recalculated PSV", {
        pointId,
        dimensions: result.dimensions.length,
        totalTime: result.totalProcessingTimeMs
      });

      return result;
    } catch (error) {
      log.error("Error in recalculatePSV worker", {
        error: error.message,
        pointId
      });
      throw error;
    }
  }
};

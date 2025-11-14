/**
 * Fallacy Feedback Data Export Utility
 *
 * Exports fallacy detection feedback data in formats suitable for:
 * - Machine Learning model retraining
 * - RLHF (Reinforcement Learning from Human Feedback)
 * - Data analysis and quality assessment
 *
 * Usage:
 *   const exporter = require('./utils/exportFallacyFeedback.cjs');
 *   await exporter.exportToCSV('./output/feedback.csv');
 *   await exporter.exportToJSON('./output/feedback.json');
 *   await exporter.exportForMLTraining('./output/training-data.jsonl');
 */

const models = require('../models/index.cjs');
const fs = require('fs');
const path = require('path');
const log = require('./logger.cjs');

class FallacyFeedbackExporter {
  /**
   * Get all fallacy feedback data with related information
   */
  async getAllFeedbackData() {
    try {
      const fallacyLabels = await models.CommentFallacyLabel.findAll({
        include: [
          {
            model: models.Point,
            attributes: ['id', 'content', 'value', 'post_id', 'user_id', 'created_at'],
            include: [
              {
                model: models.User,
                attributes: ['id', 'name']
              },
              {
                model: models.Post,
                attributes: ['id', 'name', 'description', 'group_id']
              }
            ]
          },
          {
            model: models.FallacyFeedback,
            as: 'Feedbacks',
            include: [
              {
                model: models.User,
                attributes: ['id', 'name']
              }
            ]
          },
          {
            model: models.User,
            as: 'Moderator',
            attributes: ['id', 'name']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return fallacyLabels;
    } catch (error) {
      log.error('Error fetching fallacy feedback data', { error });
      throw error;
    }
  }

  /**
   * Calculate consensus and confidence for a fallacy label
   */
  calculateConsensus(feedbacks) {
    if (!feedbacks || feedbacks.length === 0) {
      return {
        consensus: 'uncertain',
        consensus_score: 0,
        total_feedbacks: 0,
        correct_count: 0,
        false_positive_count: 0,
        wrong_type_count: 0,
        positive_rate: 0,
        negative_rate: 0
      };
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

    const positive_rate = (stats.correct / stats.total) * 100;
    const negative_rate = ((stats.false_positive + stats.wrong_type) / stats.total) * 100;

    let consensus = 'uncertain';
    let consensus_score = 0;

    if (positive_rate >= 70) {
      consensus = 'confirmed';
      consensus_score = positive_rate / 100;
    } else if (negative_rate >= 70) {
      consensus = 'rejected';
      consensus_score = negative_rate / 100;
    } else if (stats.total >= 5 && positive_rate >= 50) {
      consensus = 'likely_correct';
      consensus_score = positive_rate / 100;
    } else if (stats.total >= 5 && negative_rate >= 50) {
      consensus = 'likely_incorrect';
      consensus_score = negative_rate / 100;
    }

    return {
      consensus,
      consensus_score,
      total_feedbacks: stats.total,
      correct_count: stats.correct,
      false_positive_count: stats.false_positive,
      wrong_type_count: stats.wrong_type,
      positive_rate: positive_rate.toFixed(2),
      negative_rate: negative_rate.toFixed(2)
    };
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(outputPath) {
    try {
      const data = await this.getAllFeedbackData();
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
        const consensus = this.calculateConsensus(label.Feedbacks);

        const row = [
          label.id,
          label.point_id,
          this.escapeCSV(label.Point?.content || ''),
          label.fallacy_type,
          label.confidence_score,
          this.escapeCSV(label.ai_explanation || ''),
          this.escapeCSV(label.ai_suggestion || ''),
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

      const csv = rows.join('\n');
      fs.writeFileSync(outputPath, csv, 'utf8');

      log.info('CSV export completed', {
        outputPath,
        recordCount: data.length
      });

      return {
        success: true,
        path: outputPath,
        recordCount: data.length
      };
    } catch (error) {
      log.error('Error exporting to CSV', { error });
      throw error;
    }
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(outputPath) {
    try {
      const data = await this.getAllFeedbackData();
      const exportData = [];

      for (const label of data) {
        const consensus = this.calculateConsensus(label.Feedbacks);

        exportData.push({
          fallacy_label_id: label.id,
          point_id: label.point_id,
          comment_text: label.Point?.content || '',
          detected_fallacy: label.fallacy_type,
          ai_confidence: label.confidence_score,
          ai_explanation: label.ai_explanation,
          ai_suggestion: label.ai_suggestion,
          text_excerpt: label.text_excerpt,
          model_version: label.model_version,
          status: label.status,
          moderator_override: label.moderator_override,
          moderator_notes: label.moderator_notes,
          feedback: {
            total: consensus.total_feedbacks,
            correct: consensus.correct_count,
            false_positive: consensus.false_positive_count,
            wrong_type: consensus.wrong_type_count,
            consensus: consensus.consensus,
            consensus_score: consensus.consensus_score,
            positive_rate: parseFloat(consensus.positive_rate),
            negative_rate: parseFloat(consensus.negative_rate)
          },
          created_at: label.created_at,
          updated_at: label.updated_at
        });
      }

      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

      log.info('JSON export completed', {
        outputPath,
        recordCount: data.length
      });

      return {
        success: true,
        path: outputPath,
        recordCount: data.length
      };
    } catch (error) {
      log.error('Error exporting to JSON', { error });
      throw error;
    }
  }

  /**
   * Export in JSONL format for ML training
   * Each line is a JSON object suitable for fine-tuning language models
   */
  async exportForMLTraining(outputPath, options = {}) {
    try {
      const {
        minFeedbacks = 3,
        includeUncertain = false,
        includeModeratorOverridden = true
      } = options;

      const data = await this.getAllFeedbackData();
      const trainingExamples = [];

      for (const label of data) {
        const consensus = this.calculateConsensus(label.Feedbacks);

        // Filter based on options
        if (consensus.total_feedbacks < minFeedbacks) continue;
        if (!includeUncertain && consensus.consensus === 'uncertain') continue;
        if (!includeModeratorOverridden && label.moderator_override) continue;

        // Format for ML training
        const example = {
          text: label.Point?.content || '',
          detected_fallacy: label.fallacy_type,
          ai_confidence: label.confidence_score,
          community_consensus: consensus.consensus,
          consensus_score: consensus.consensus_score,
          is_true_positive: consensus.consensus === 'confirmed',
          is_false_positive: consensus.consensus === 'rejected',
          feedback_count: consensus.total_feedbacks,
          metadata: {
            fallacy_label_id: label.id,
            point_id: label.point_id,
            model_version: label.model_version,
            moderator_override: label.moderator_override,
            created_at: label.created_at
          }
        };

        trainingExamples.push(JSON.stringify(example));
      }

      const jsonl = trainingExamples.join('\n');
      fs.writeFileSync(outputPath, jsonl, 'utf8');

      log.info('ML training data export completed', {
        outputPath,
        recordCount: trainingExamples.length
      });

      return {
        success: true,
        path: outputPath,
        recordCount: trainingExamples.length
      };
    } catch (error) {
      log.error('Error exporting ML training data', { error });
      throw error;
    }
  }

  /**
   * Export detailed feedback with individual user responses
   */
  async exportDetailedFeedback(outputPath) {
    try {
      const data = await this.getAllFeedbackData();
      const detailedData = [];

      for (const label of data) {
        for (const feedback of label.Feedbacks || []) {
          detailedData.push({
            fallacy_label_id: label.id,
            fallacy_type: label.fallacy_type,
            ai_confidence: label.confidence_score,
            comment_text: label.Point?.content || '',
            feedback_id: feedback.id,
            user_id: feedback.user_id,
            feedback_type: feedback.feedback_type,
            suggested_fallacy_type: feedback.suggested_fallacy_type,
            explanation: feedback.explanation,
            confidence: feedback.confidence,
            helpful_votes: feedback.helpful_votes,
            created_at: feedback.created_at
          });
        }
      }

      fs.writeFileSync(outputPath, JSON.stringify(detailedData, null, 2), 'utf8');

      log.info('Detailed feedback export completed', {
        outputPath,
        recordCount: detailedData.length
      });

      return {
        success: true,
        path: outputPath,
        recordCount: detailedData.length
      };
    } catch (error) {
      log.error('Error exporting detailed feedback', { error });
      throw error;
    }
  }

  /**
   * Generate summary statistics
   */
  async generateStatistics() {
    try {
      const data = await this.getAllFeedbackData();

      const stats = {
        total_fallacy_labels: data.length,
        by_type: {},
        by_consensus: {
          confirmed: 0,
          rejected: 0,
          likely_correct: 0,
          likely_incorrect: 0,
          uncertain: 0
        },
        by_status: {
          active: 0,
          validated: 0,
          disputed: 0,
          overridden: 0
        },
        feedback_stats: {
          total_feedbacks: 0,
          labels_with_feedback: 0,
          labels_without_feedback: 0,
          avg_feedbacks_per_label: 0,
          moderator_overrides: 0
        }
      };

      let totalFeedbacks = 0;

      for (const label of data) {
        // By type
        stats.by_type[label.fallacy_type] = (stats.by_type[label.fallacy_type] || 0) + 1;

        // By status
        stats.by_status[label.status] = (stats.by_status[label.status] || 0) + 1;

        // Feedback stats
        const feedbackCount = label.Feedbacks?.length || 0;
        totalFeedbacks += feedbackCount;

        if (feedbackCount > 0) {
          stats.feedback_stats.labels_with_feedback++;
          const consensus = this.calculateConsensus(label.Feedbacks);
          stats.by_consensus[consensus.consensus]++;
        } else {
          stats.feedback_stats.labels_without_feedback++;
        }

        if (label.moderator_override) {
          stats.feedback_stats.moderator_overrides++;
        }
      }

      stats.feedback_stats.total_feedbacks = totalFeedbacks;
      stats.feedback_stats.avg_feedbacks_per_label = data.length > 0
        ? (totalFeedbacks / data.length).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      log.error('Error generating statistics', { error });
      throw error;
    }
  }

  /**
   * Helper: Escape CSV values
   */
  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }
}

// Export singleton instance
const exporter = new FallacyFeedbackExporter();

module.exports = exporter;

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const outputPath = args[1] || './fallacy-feedback-export.csv';

  (async () => {
    try {
      switch (command) {
        case 'csv':
          await exporter.exportToCSV(outputPath);
          console.log(`CSV export completed: ${outputPath}`);
          break;

        case 'json':
          await exporter.exportToJSON(outputPath);
          console.log(`JSON export completed: ${outputPath}`);
          break;

        case 'ml':
          await exporter.exportForMLTraining(outputPath);
          console.log(`ML training data export completed: ${outputPath}`);
          break;

        case 'detailed':
          await exporter.exportDetailedFeedback(outputPath);
          console.log(`Detailed feedback export completed: ${outputPath}`);
          break;

        case 'stats':
          const stats = await exporter.generateStatistics();
          console.log('Fallacy Feedback Statistics:');
          console.log(JSON.stringify(stats, null, 2));
          break;

        default:
          console.log(`
Fallacy Feedback Export Utility

Usage:
  node exportFallacyFeedback.cjs <command> [outputPath]

Commands:
  csv       - Export to CSV format
  json      - Export to JSON format
  ml        - Export for ML training (JSONL format)
  detailed  - Export detailed feedback with individual responses
  stats     - Generate and display statistics

Examples:
  node exportFallacyFeedback.cjs csv ./output/feedback.csv
  node exportFallacyFeedback.cjs ml ./output/training-data.jsonl
  node exportFallacyFeedback.cjs stats
          `);
      }
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}

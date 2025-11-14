'use strict';

/**
 * Migration: Fallacy Feedback System
 * Creates tables for:
 * 1. comment_fallacy_labels - Stores AI-detected fallacies in comments/points
 * 2. fallacy_feedback - Stores user feedback on fallacy detections
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create comment_fallacy_labels table
    await queryInterface.createTable('comment_fallacy_labels', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      point_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'points',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fallacy_type: {
        type: Sequelize.ENUM(
          'ad_hominem',
          'ad_populum',
          'false_causality',
          'circular_reasoning',
          'straw_man',
          'false_dilemma',
          'appeal_to_authority',
          'slippery_slope',
          'hasty_generalization',
          'red_herring',
          'tu_quoque',
          'no_true_scotsman',
          'burden_of_proof'
        ),
        allowNull: false,
      },
      confidence_score: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        validate: {
          min: 0.0,
          max: 1.0
        }
      },
      text_excerpt: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The specific text that triggered the fallacy detection'
      },
      ai_explanation: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'AI-generated explanation of why this is a fallacy'
      },
      ai_suggestion: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'AI-generated suggestion for improving the argument'
      },
      model_version: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Version of the AI model that made this detection'
      },
      status: {
        type: Sequelize.ENUM('active', 'overridden', 'validated', 'disputed'),
        allowNull: false,
        defaultValue: 'active'
      },
      moderator_override: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      moderator_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      moderator_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create fallacy_feedback table
    await queryInterface.createTable('fallacy_feedback', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      fallacy_label_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'comment_fallacy_labels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      feedback_type: {
        type: Sequelize.ENUM(
          'correct',
          'false_positive',
          'wrong_type',
          'missed_fallacy'
        ),
        allowNull: false,
      },
      suggested_fallacy_type: {
        type: Sequelize.ENUM(
          'ad_hominem',
          'ad_populum',
          'false_causality',
          'circular_reasoning',
          'straw_man',
          'false_dilemma',
          'appeal_to_authority',
          'slippery_slope',
          'hasty_generalization',
          'red_herring',
          'tu_quoque',
          'no_true_scotsman',
          'burden_of_proof'
        ),
        allowNull: true,
        comment: 'User suggestion if feedback_type is wrong_type'
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional user explanation for their feedback'
      },
      confidence: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 5,
        validate: {
          min: 1,
          max: 10
        },
        comment: 'User confidence in their feedback (1-10 scale)'
      },
      helpful_votes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of users who found this feedback helpful'
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional metadata (browser info, context, etc.)'
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for comment_fallacy_labels
    await queryInterface.addIndex('comment_fallacy_labels', ['uuid'], {
      unique: true,
    });
    await queryInterface.addIndex('comment_fallacy_labels', ['point_id']);
    await queryInterface.addIndex('comment_fallacy_labels', ['fallacy_type']);
    await queryInterface.addIndex('comment_fallacy_labels', ['status']);
    await queryInterface.addIndex('comment_fallacy_labels', ['created_at']);

    // Add indexes for fallacy_feedback
    await queryInterface.addIndex('fallacy_feedback', ['uuid'], {
      unique: true,
    });
    await queryInterface.addIndex('fallacy_feedback', ['fallacy_label_id']);
    await queryInterface.addIndex('fallacy_feedback', ['user_id']);
    await queryInterface.addIndex('fallacy_feedback', ['feedback_type']);
    await queryInterface.addIndex('fallacy_feedback', ['created_at']);

    // Composite index for preventing duplicate votes
    await queryInterface.addIndex('fallacy_feedback', ['fallacy_label_id', 'user_id'], {
      unique: true,
      name: 'unique_user_feedback_per_fallacy'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fallacy_feedback');
    await queryInterface.dropTable('comment_fallacy_labels');
  }
};

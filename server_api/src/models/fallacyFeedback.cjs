"use strict";

/**
 * FallacyFeedback Model
 * Stores user feedback on AI fallacy detections
 */

module.exports = (sequelize, DataTypes) => {
  const FallacyFeedback = sequelize.define("FallacyFeedback", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    feedback_type: {
      type: DataTypes.ENUM(
        'correct',
        'false_positive',
        'wrong_type',
        'missed_fallacy'
      ),
      allowNull: false
    },
    suggested_fallacy_type: {
      type: DataTypes.ENUM(
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
      allowNull: true
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    confidence: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 10
      }
    },
    helpful_votes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    underscored: true,
    tableName: 'fallacy_feedback',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    defaultScope: {
      where: {
        deleted: false
      }
    },

    indexes: [
      {
        fields: ['uuid'],
        unique: true
      },
      {
        fields: ['fallacy_label_id', 'deleted']
      },
      {
        fields: ['user_id', 'deleted']
      },
      {
        fields: ['feedback_type', 'deleted']
      },
      {
        fields: ['created_at']
      },
      {
        // Prevent duplicate votes
        fields: ['fallacy_label_id', 'user_id'],
        unique: true,
        name: 'unique_user_feedback_per_fallacy'
      }
    ]
  });

  FallacyFeedback.associate = (models) => {
    FallacyFeedback.belongsTo(models.CommentFallacyLabel, {
      foreignKey: 'fallacy_label_id',
      as: 'FallacyLabel'
    });
    FallacyFeedback.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  // Helper method to check if feedback is positive
  FallacyFeedback.prototype.isPositiveFeedback = function() {
    return this.feedback_type === 'correct';
  };

  // Helper method to check if feedback is negative
  FallacyFeedback.prototype.isNegativeFeedback = function() {
    return ['false_positive', 'wrong_type'].includes(this.feedback_type);
  };

  // Class method to aggregate feedback for a fallacy label
  FallacyFeedback.getAggregatedStats = async (fallacyLabelId) => {
    const feedbacks = await FallacyFeedback.findAll({
      where: { fallacy_label_id: fallacyLabelId }
    });

    const stats = {
      total: feedbacks.length,
      correct: 0,
      false_positive: 0,
      wrong_type: 0,
      missed_fallacy: 0,
      positive_percentage: 0,
      negative_percentage: 0,
      is_controversial: false
    };

    feedbacks.forEach(feedback => {
      stats[feedback.feedback_type]++;
    });

    if (stats.total > 0) {
      stats.positive_percentage = (stats.correct / stats.total) * 100;
      stats.negative_percentage = ((stats.false_positive + stats.wrong_type) / stats.total) * 100;
      // Mark as controversial if >30% negative feedback
      stats.is_controversial = stats.negative_percentage > 30;
    }

    return stats;
  };

  return FallacyFeedback;
};

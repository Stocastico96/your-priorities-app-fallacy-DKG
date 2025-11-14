"use strict";

/**
 * CommentFallacyLabel Model
 * Stores AI-detected fallacies in points/comments
 */

module.exports = (sequelize, DataTypes) => {
  const CommentFallacyLabel = sequelize.define("CommentFallacyLabel", {
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    fallacy_type: {
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
      allowNull: false
    },
    confidence_score: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0.0,
        max: 1.0
      }
    },
    text_excerpt: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ai_explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ai_suggestion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    model_version: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'overridden', 'validated', 'disputed'),
      allowNull: false,
      defaultValue: 'active'
    },
    moderator_override: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    moderator_notes: {
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
    tableName: 'comment_fallacy_labels',
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
        fields: ['point_id', 'deleted']
      },
      {
        fields: ['fallacy_type', 'deleted']
      },
      {
        fields: ['status', 'deleted']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  CommentFallacyLabel.associate = (models) => {
    CommentFallacyLabel.belongsTo(models.Point, { foreignKey: 'point_id' });
    CommentFallacyLabel.belongsTo(models.User, {
      as: 'Moderator',
      foreignKey: 'moderator_user_id'
    });
    CommentFallacyLabel.hasMany(models.FallacyFeedback, {
      foreignKey: 'fallacy_label_id',
      as: 'Feedbacks'
    });
  };

  // Helper method to get human-readable fallacy name
  CommentFallacyLabel.prototype.getFallacyDisplayName = function() {
    const displayNames = {
      'ad_hominem': 'Ad Hominem',
      'ad_populum': 'Ad Populum (Appeal to Popularity)',
      'false_causality': 'False Causality (Post Hoc)',
      'circular_reasoning': 'Circular Reasoning',
      'straw_man': 'Straw Man',
      'false_dilemma': 'False Dilemma',
      'appeal_to_authority': 'Appeal to Authority',
      'slippery_slope': 'Slippery Slope',
      'hasty_generalization': 'Hasty Generalization',
      'red_herring': 'Red Herring',
      'tu_quoque': 'Tu Quoque',
      'no_true_scotsman': 'No True Scotsman',
      'burden_of_proof': 'Burden of Proof'
    };
    return displayNames[this.fallacy_type] || this.fallacy_type;
  };

  // Class method to get all fallacy types
  CommentFallacyLabel.getAllFallacyTypes = () => {
    return [
      { value: 'ad_hominem', label: 'Ad Hominem' },
      { value: 'ad_populum', label: 'Ad Populum (Appeal to Popularity)' },
      { value: 'false_causality', label: 'False Causality (Post Hoc)' },
      { value: 'circular_reasoning', label: 'Circular Reasoning' },
      { value: 'straw_man', label: 'Straw Man' },
      { value: 'false_dilemma', label: 'False Dilemma' },
      { value: 'appeal_to_authority', label: 'Appeal to Authority' },
      { value: 'slippery_slope', label: 'Slippery Slope' },
      { value: 'hasty_generalization', label: 'Hasty Generalization' },
      { value: 'red_herring', label: 'Red Herring' },
      { value: 'tu_quoque', label: 'Tu Quoque' },
      { value: 'no_true_scotsman', label: 'No True Scotsman' },
      { value: 'burden_of_proof', label: 'Burden of Proof' }
    ];
  };

  return CommentFallacyLabel;
};

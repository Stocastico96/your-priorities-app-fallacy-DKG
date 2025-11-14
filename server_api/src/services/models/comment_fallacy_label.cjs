"use strict";

/**
 * CommentFallacyLabel Model
 * Stores fallacy detection results with educational feedback
 * for deliberative democracy platform
 */

module.exports = (sequelize, DataTypes) => {
  const CommentFallacyLabel = sequelize.define(
    "CommentFallacyLabel",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      point_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Reference to Point (comment) that was analyzed"
      },
      fallacy_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Type of fallacy detected (e.g., 'ad_hominem', 'straw_man')"
      },
      confidence_score: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: "Confidence score from ML model (0.0-1.0)"
      },
      text_span: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Specific text span where fallacy was detected"
      },
      start_char: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Start character position of fallacy in text"
      },
      end_char: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "End character position of fallacy in text"
      },
      educational_feedback: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Educational feedback object with explanation, examples, resources"
      },
      detected_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: "When the fallacy was detected"
      },
      detection_model_version: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: "Version of the ML model used for detection"
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "User who wrote the comment (for analytics)"
      },
      user_feedback_helpful: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: "User feedback: was this detection helpful? (null=no feedback, true=helpful, false=not helpful)"
      },
      feedback_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "User who provided feedback on detection"
      },
      feedback_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When user provided feedback"
      },
      validation_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        comment: "Validation status: pending, validated, disputed, false_positive"
      },
      validated_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "User who validated/disputed the detection"
      },
      validated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When the detection was validated/disputed"
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: "comment_fallacy_labels",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "idx_comment_fallacy_labels_point_id",
          fields: ["point_id"]
        },
        {
          name: "idx_comment_fallacy_labels_fallacy_type",
          fields: ["fallacy_type"]
        },
        {
          name: "idx_comment_fallacy_labels_validation_status",
          fields: ["validation_status"]
        },
        {
          name: "idx_comment_fallacy_labels_detected_at",
          fields: ["detected_at"]
        },
        {
          name: "idx_comment_fallacy_labels_user_feedback",
          fields: ["user_feedback_helpful"]
        }
      ]
    }
  );

  CommentFallacyLabel.associate = (models) => {
    // Association with Point (comment)
    CommentFallacyLabel.belongsTo(models.Point, {
      foreignKey: "point_id",
      as: "Point"
    });

    // Association with User (comment author)
    CommentFallacyLabel.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "User"
    });

    // Association with User (feedback provider)
    CommentFallacyLabel.belongsTo(models.User, {
      foreignKey: "feedback_user_id",
      as: "FeedbackUser"
    });

    // Association with User (validator)
    CommentFallacyLabel.belongsTo(models.User, {
      foreignKey: "validated_by_user_id",
      as: "ValidatedByUser"
    });
  };

  return CommentFallacyLabel;
};

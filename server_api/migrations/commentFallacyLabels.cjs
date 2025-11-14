"use strict";

/**
 * Migration: Create comment_fallacy_labels table
 * For storing fallacy detection results with educational feedback
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("comment_fallacy_labels", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      point_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "points",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "Reference to Point (comment) that was analyzed"
      },
      fallacy_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "Type of fallacy detected (e.g., 'ad_hominem', 'straw_man')"
      },
      confidence_score: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0.0,
        comment: "Confidence score from ML model (0.0-1.0)"
      },
      text_span: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Specific text span where fallacy was detected"
      },
      start_char: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Start character position of fallacy in text"
      },
      end_char: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "End character position of fallacy in text"
      },
      educational_feedback: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Educational feedback object with explanation, examples, resources"
      },
      detected_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: "When the fallacy was detected"
      },
      detection_model_version: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: "Version of the ML model used for detection"
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "User who wrote the comment (for analytics)"
      },
      user_feedback_helpful: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        comment: "User feedback: was this detection helpful?"
      },
      feedback_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "User who provided feedback on detection"
      },
      feedback_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When user provided feedback"
      },
      validation_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        comment: "Validation status: pending, validated, disputed, false_positive"
      },
      validated_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "User who validated/disputed the detection"
      },
      validated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the detection was validated/disputed"
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex("comment_fallacy_labels", ["point_id"], {
      name: "idx_comment_fallacy_labels_point_id"
    });

    await queryInterface.addIndex("comment_fallacy_labels", ["fallacy_type"], {
      name: "idx_comment_fallacy_labels_fallacy_type"
    });

    await queryInterface.addIndex("comment_fallacy_labels", ["validation_status"], {
      name: "idx_comment_fallacy_labels_validation_status"
    });

    await queryInterface.addIndex("comment_fallacy_labels", ["detected_at"], {
      name: "idx_comment_fallacy_labels_detected_at"
    });

    await queryInterface.addIndex("comment_fallacy_labels", ["user_feedback_helpful"], {
      name: "idx_comment_fallacy_labels_user_feedback"
    });

    console.log("✓ Created comment_fallacy_labels table with indexes");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("comment_fallacy_labels");
    console.log("✓ Dropped comment_fallacy_labels table");
  }
};

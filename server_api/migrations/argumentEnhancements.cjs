"use strict";

/**
 * Migration: Create argument_enhancements table
 *
 * This table tracks usage of the Argument Enhancement Module
 * for analytics and improving the AI suggestions over time.
 *
 * Features tracked:
 * - Original user text
 * - AI-generated suggestions
 * - Strength score and components identified
 * - User feedback (applied suggestions, helpfulness ratings)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("argument_enhancements", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      post_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "posts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      original_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      strength_score: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "AI-assigned strength score 1-10",
      },

      components: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Identified argument components (claim, evidence, warrant, etc.)",
      },

      suggestions: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Array of improvement suggestions",
      },

      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Processing metadata (model used, processing time, etc.)",
      },

      applied_suggestions: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Suggestions that user applied",
      },

      user_feedback: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "User feedback: 'helpful', 'not_helpful', or null",
      },

      revised_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "User's final text after applying suggestions (if different from original)",
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

    // Add indexes for common queries
    await queryInterface.addIndex("argument_enhancements", ["user_id"], {
      name: "argument_enhancements_user_id_idx",
    });

    await queryInterface.addIndex("argument_enhancements", ["post_id"], {
      name: "argument_enhancements_post_id_idx",
    });

    await queryInterface.addIndex("argument_enhancements", ["created_at"], {
      name: "argument_enhancements_created_at_idx",
    });

    await queryInterface.addIndex("argument_enhancements", ["user_feedback"], {
      name: "argument_enhancements_user_feedback_idx",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("argument_enhancements");
  },
};

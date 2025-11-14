"use strict";

/**
 * ArgumentEnhancement Model
 *
 * Tracks usage of the Argument Enhancement Module for analytics
 * and continuous improvement of AI suggestions
 */

module.exports = (sequelize, DataTypes) => {
  const ArgumentEnhancement = sequelize.define(
    "ArgumentEnhancement",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      post_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      original_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      strength_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 10,
        },
      },

      components: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      suggestions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },

      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      applied_suggestions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },

      user_feedback: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isIn: [["helpful", "not_helpful"]],
        },
      },

      revised_text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "argument_enhancements",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",

      indexes: [
        {
          fields: ["user_id"],
        },
        {
          fields: ["post_id"],
        },
        {
          fields: ["created_at"],
        },
        {
          fields: ["user_feedback"],
        },
      ],
    }
  );

  ArgumentEnhancement.associate = (models) => {
    ArgumentEnhancement.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "User",
    });

    ArgumentEnhancement.belongsTo(models.Post, {
      foreignKey: "post_id",
      as: "Post",
    });
  };

  return ArgumentEnhancement;
};

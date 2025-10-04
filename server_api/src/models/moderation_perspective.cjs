"use strict";

module.exports = (sequelize, DataTypes) => {
  const ModerationPerspective = sequelize.define(
    "ModerationPerspective",
    {
      content_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      toxicity: DataTypes.FLOAT,
      severe_toxicity: DataTypes.FLOAT,
      insult: DataTypes.FLOAT,
      profanity: DataTypes.FLOAT,
      threat: DataTypes.FLOAT,
      identity_attack: DataTypes.FLOAT,
      sexually_explicit: DataTypes.FLOAT,
      flirtation: DataTypes.FLOAT,
      spam: DataTypes.FLOAT,
      decision: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      raw: DataTypes.JSONB,
    },
    {
      tableName: "moderation_perspective",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        {
          fields: ["content_type", "content_id"],
        },
      ],
    }
  );

  return ModerationPerspective;
};

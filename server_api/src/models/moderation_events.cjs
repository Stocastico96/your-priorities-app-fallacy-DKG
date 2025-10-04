"use strict";

module.exports = (sequelize, DataTypes) => {
  const ModerationEvents = sequelize.define(
    "ModerationEvents",
    {
      event_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      properties: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: "moderation_events",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        {
          fields: ["event_name"],
        },
      ],
    }
  );

  return ModerationEvents;
};

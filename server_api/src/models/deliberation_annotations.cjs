"use strict";

module.exports = (sequelize, DataTypes) => {
  const DeliberationAnnotations = sequelize.define(
    "DeliberationAnnotations",
    {
      content_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      jsonld: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      model: DataTypes.STRING,
      confidence: DataTypes.FLOAT,
    },
    {
      tableName: "deliberation_annotations",
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

  return DeliberationAnnotations;
};

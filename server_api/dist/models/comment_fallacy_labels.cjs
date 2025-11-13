"use strict";
module.exports = (sequelize, DataTypes) => {
    const CommentFallacyLabels = sequelize.define("CommentFallacyLabels", {
        content_type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        content_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        labels: {
            type: DataTypes.JSONB,
            allowNull: false,
        },
        scores: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        advice: DataTypes.TEXT,
        rewrite: DataTypes.TEXT,
        model: DataTypes.STRING,
        provider: DataTypes.STRING,
        latency_ms: DataTypes.INTEGER,
    }, {
        tableName: "comment_fallacy_labels",
        underscored: true,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
        indexes: [
            {
                fields: ["content_type", "content_id"],
            },
        ],
    });
    return CommentFallacyLabels;
};

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommentFallacyLabel = sequelize.define('CommentFallacyLabel', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    content_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    labels: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    scores: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    advice: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rewrite: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true
    },
    latency_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'comment_fallacy_labels',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['content_type', 'content_id']
      }
    ]
  });

  return CommentFallacyLabel;
};

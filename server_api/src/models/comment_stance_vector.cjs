"use strict";

module.exports = (sequelize, DataTypes) => {
  const CommentStanceVector = sequelize.define("CommentStanceVector", {
    point_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dimension_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    stance_value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: -1,
        max: 1
      }
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 1
      }
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    raw_llm_response: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    processing_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'comment_stance_vectors',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['point_id']
      },
      {
        fields: ['dimension_id']
      },
      {
        unique: true,
        fields: ['point_id', 'dimension_id'],
        name: 'unique_point_dimension'
      }
    ]
  });

  CommentStanceVector.associate = (models) => {
    CommentStanceVector.belongsTo(models.Point, { foreignKey: 'point_id' });
    CommentStanceVector.belongsTo(models.DeliberationDimension, {
      foreignKey: 'dimension_id',
      as: 'Dimension'
    });
  };

  return CommentStanceVector;
};

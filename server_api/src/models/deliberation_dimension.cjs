"use strict";

module.exports = (sequelize, DataTypes) => {
  const DeliberationDimension = sequelize.define("DeliberationDimension", {
    group_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dimension_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dimension_description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    scale_negative_label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    scale_positive_label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'deliberation_dimensions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['group_id']
      },
      {
        fields: ['post_id']
      },
      {
        fields: ['active']
      }
    ]
  });

  DeliberationDimension.associate = (models) => {
    DeliberationDimension.belongsTo(models.Group, { foreignKey: 'group_id' });
    DeliberationDimension.belongsTo(models.Post, { foreignKey: 'post_id' });
    DeliberationDimension.hasMany(models.CommentStanceVector, {
      foreignKey: 'dimension_id',
      as: 'StanceVectors'
    });
  };

  return DeliberationDimension;
};

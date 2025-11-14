'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create deliberation_dimensions table
    await queryInterface.createTable('deliberation_dimensions', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'groups',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      post_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'posts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      dimension_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      dimension_description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      scale_negative_label: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scale_positive_label: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      position: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
    });

    // Create comment_stance_vectors table
    await queryInterface.createTable('comment_stance_vectors', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      point_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'points',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      dimension_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'deliberation_dimensions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
        allowNull: true,
      },
      raw_llm_response: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      processing_time_ms: {
        type: DataTypes.INTEGER,
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
    });

    // Add indexes for deliberation_dimensions
    await queryInterface.addIndex('deliberation_dimensions', ['group_id']);
    await queryInterface.addIndex('deliberation_dimensions', ['post_id']);
    await queryInterface.addIndex('deliberation_dimensions', ['active']);

    // Add indexes for comment_stance_vectors
    await queryInterface.addIndex('comment_stance_vectors', ['point_id']);
    await queryInterface.addIndex('comment_stance_vectors', ['dimension_id']);
    await queryInterface.addIndex('comment_stance_vectors', ['point_id', 'dimension_id'], {
      unique: true,
      name: 'unique_point_dimension'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('comment_stance_vectors');
    await queryInterface.dropTable('deliberation_dimensions');
  }
};

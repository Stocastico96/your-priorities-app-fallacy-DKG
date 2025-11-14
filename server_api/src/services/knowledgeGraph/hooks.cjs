"use strict";

const RDFConverter = require('./rdfConverter.cjs');
const log = require('../../utils/logger.cjs');
const queue = require('../workers/queue.cjs');

/**
 * Database Hooks for Real-time RDF Generation
 *
 * These hooks automatically convert database entities to RDF triples
 * and push them to the knowledge graph when entities are created or updated.
 */

// Initialize RDF converter
const rdfConverter = new RDFConverter();

// Feature flag to enable/disable KG sync
const KG_SYNC_ENABLED = process.env.KG_SYNC_ENABLED !== 'false';

/**
 * Queue job for async RDF conversion
 * This prevents blocking the main request
 */
function queueRDFConversion(entityType, entityData, operation = 'create') {
  if (!KG_SYNC_ENABLED) {
    return;
  }

  // Use the existing queue system
  queue.create('rdf-conversion', {
    entityType,
    entityData,
    operation,
    timestamp: new Date().toISOString()
  })
    .priority('normal')
    .attempts(3)
    .backoff({ delay: 60000, type: 'exponential' })
    .save((err) => {
      if (err) {
        log.error('Failed to queue RDF conversion', {
          error: err.message,
          entityType,
          entityId: entityData.id
        });
      } else {
        log.debug('RDF conversion queued', {
          entityType,
          entityId: entityData.id,
          operation
        });
      }
    });
}

/**
 * Process RDF conversion job
 * This is the worker that actually performs the conversion
 */
async function processRDFConversion(job, done) {
  const { entityType, entityData, operation } = job.data;

  try {
    log.info('Processing RDF conversion', {
      entityType,
      entityId: entityData.id,
      operation
    });

    let turtle;

    // Convert to RDF based on entity type
    switch (entityType) {
      case 'Group':
        turtle = rdfConverter.convertGroupToRDF(entityData);
        break;

      case 'Post':
        turtle = rdfConverter.convertPostToRDF(entityData);
        break;

      case 'Point':
        turtle = rdfConverter.convertPointToRDF(entityData);
        break;

      case 'User':
        // Anonymize by default for privacy
        turtle = rdfConverter.convertUserToRDF(entityData, { anonymize: false });
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Insert into triplestore
    if (operation === 'create' || operation === 'update') {
      const result = await rdfConverter.insertRDF(turtle);

      if (!result.success) {
        throw new Error(`RDF insertion failed: ${result.error}`);
      }

      log.info('RDF conversion completed', {
        entityType,
        entityId: entityData.id,
        operation
      });
    } else if (operation === 'delete') {
      const entityUri = rdfConverter.uri(entityType.toLowerCase(), entityData.id);
      const result = await rdfConverter.deleteEntity(entityUri);

      if (!result.success) {
        throw new Error(`RDF deletion failed: ${result.error}`);
      }

      log.info('RDF entity deleted', {
        entityType,
        entityId: entityData.id
      });
    }

    done();

  } catch (error) {
    log.error('RDF conversion job failed', {
      error: error.message,
      stack: error.stack,
      entityType,
      entityId: entityData.id,
      operation
    });

    done(error);
  }
}

/**
 * Sequelize Hooks
 */

/**
 * Group hooks
 */
function addGroupHooks(Group) {
  Group.afterCreate((group, options) => {
    queueRDFConversion('Group', group.toJSON(), 'create');
  });

  Group.afterUpdate((group, options) => {
    // Only sync if important fields changed
    if (group.changed('name') || group.changed('objectives') || group.changed('status')) {
      queueRDFConversion('Group', group.toJSON(), 'update');
    }
  });

  Group.afterDestroy((group, options) => {
    queueRDFConversion('Group', { id: group.id }, 'delete');
  });
}

/**
 * Post hooks
 */
function addPostHooks(Post) {
  Post.afterCreate((post, options) => {
    queueRDFConversion('Post', post.toJSON(), 'create');
  });

  Post.afterUpdate((post, options) => {
    // Only sync if important fields changed
    if (post.changed('name') || post.changed('description') || post.changed('status')) {
      queueRDFConversion('Post', post.toJSON(), 'update');
    }
  });

  Post.afterDestroy((post, options) => {
    queueRDFConversion('Post', { id: post.id }, 'delete');
  });
}

/**
 * Point hooks
 */
function addPointHooks(Point) {
  Point.afterCreate((point, options) => {
    queueRDFConversion('Point', point.toJSON(), 'create');
  });

  Point.afterUpdate((point, options) => {
    // Only sync if important fields changed
    if (point.changed('content') || point.changed('value')) {
      queueRDFConversion('Point', point.toJSON(), 'update');
    }
  });

  Point.afterDestroy((point, options) => {
    queueRDFConversion('Point', { id: point.id }, 'delete');
  });
}

/**
 * User hooks
 */
function addUserHooks(User) {
  User.afterCreate((user, options) => {
    queueRDFConversion('User', user.toJSON(), 'create');
  });

  User.afterUpdate((user, options) => {
    // Only sync if public fields changed
    if (user.changed('name') || user.changed('description')) {
      queueRDFConversion('User', user.toJSON(), 'update');
    }
  });

  User.afterDestroy((user, options) => {
    queueRDFConversion('User', { id: user.id }, 'delete');
  });
}

/**
 * Initialize all hooks
 * Call this after models are loaded
 */
function initializeKnowledgeGraphHooks(sequelize) {
  if (!KG_SYNC_ENABLED) {
    log.info('Knowledge Graph sync is disabled');
    return;
  }

  log.info('Initializing Knowledge Graph hooks');

  const { Group, Post, Point, User } = sequelize.models;

  addGroupHooks(Group);
  addPostHooks(Post);
  addPointHooks(Point);
  addUserHooks(User);

  // Register worker to process RDF conversion jobs
  queue.process('rdf-conversion', 5, processRDFConversion);

  log.info('Knowledge Graph hooks initialized successfully');
}

module.exports = {
  initializeKnowledgeGraphHooks,
  queueRDFConversion,
  processRDFConversion
};

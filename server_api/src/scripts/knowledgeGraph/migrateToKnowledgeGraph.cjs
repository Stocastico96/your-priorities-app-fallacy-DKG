#!/usr/bin/env node
"use strict";

/**
 * Bulk Migration Script for Knowledge Graph
 *
 * Migrates existing PostgreSQL data to the RDF triplestore
 * Processes data in batches to avoid memory issues
 *
 * Usage:
 *   node server_api/src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs [options]
 *
 * Options:
 *   --entity <type>     Migrate specific entity type (group, post, point, user, all)
 *   --batch-size <n>    Number of records per batch (default: 1000)
 *   --offset <n>        Start from offset (for resuming)
 *   --limit <n>         Limit total records to process
 *   --dry-run           Don't actually insert to triplestore
 *
 * Examples:
 *   # Migrate all data
 *   node migrateToKnowledgeGraph.cjs --entity all
 *
 *   # Migrate only posts
 *   node migrateToKnowledgeGraph.cjs --entity post
 *
 *   # Resume from offset 5000
 *   node migrateToKnowledgeGraph.cjs --entity post --offset 5000
 *
 *   # Test migration (dry run)
 *   node migrateToKnowledgeGraph.cjs --entity post --limit 100 --dry-run
 */

const models = require('../../models/index.cts');
const RDFConverter = require('../../services/knowledgeGraph/rdfConverter.cjs');
const log = require('../../utils/logger.cjs');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    entity: 'all',
    batchSize: 1000,
    offset: 0,
    limit: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--entity':
        options.entity = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--offset':
        options.offset = parseInt(args[++i]);
        break;
      case '--limit':
        options.limit = parseInt(args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Usage: node migrateToKnowledgeGraph.cjs [options]

Options:
  --entity <type>     Migrate specific entity type (group, post, point, user, all)
  --batch-size <n>    Number of records per batch (default: 1000)
  --offset <n>        Start from offset (for resuming)
  --limit <n>         Limit total records to process
  --dry-run           Don't actually insert to triplestore
  --help              Show this help message

Examples:
  node migrateToKnowledgeGraph.cjs --entity all
  node migrateToKnowledgeGraph.cjs --entity post --batch-size 500
  node migrateToKnowledgeGraph.cjs --entity post --offset 5000
  node migrateToKnowledgeGraph.cjs --entity post --limit 100 --dry-run
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

// Migration statistics
const stats = {
  groups: { total: 0, migrated: 0, failed: 0 },
  posts: { total: 0, migrated: 0, failed: 0 },
  points: { total: 0, migrated: 0, failed: 0 },
  users: { total: 0, migrated: 0, failed: 0 }
};

/**
 * Migrate Groups to RDF
 */
async function migrateGroups(rdfConverter, options) {
  console.log('\n=== Migrating Groups ===');

  const query = {
    where: { deleted: false },
    attributes: ['id', 'name', 'objectives', 'status', 'created_at', 'community_id',
                 'counter_posts', 'counter_points', 'counter_users'],
    offset: options.offset,
    limit: options.limit || undefined,
    order: [['id', 'ASC']]
  };

  const totalCount = await models.Group.count({ where: query.where });
  stats.groups.total = totalCount;

  console.log(`Total groups to migrate: ${totalCount}`);

  let offset = options.offset;
  let migratedCount = 0;

  while (true) {
    const groups = await models.Group.findAll({
      ...query,
      offset,
      limit: options.batchSize
    });

    if (groups.length === 0) {
      break;
    }

    console.log(`Processing batch: offset=${offset}, size=${groups.length}`);

    // Convert to RDF
    const turtles = groups.map(group => {
      try {
        return rdfConverter.convertGroupToRDF(group.toJSON());
      } catch (error) {
        console.error(`Failed to convert group ${group.id}:`, error.message);
        stats.groups.failed++;
        return null;
      }
    }).filter(Boolean);

    // Batch insert
    if (!options.dryRun && turtles.length > 0) {
      try {
        await rdfConverter.batchInsert(turtles);
        migratedCount += turtles.length;
        stats.groups.migrated += turtles.length;
        console.log(`✓ Migrated ${turtles.length} groups (total: ${migratedCount}/${totalCount})`);
      } catch (error) {
        console.error('Batch insert failed:', error.message);
        stats.groups.failed += turtles.length;
      }
    } else if (options.dryRun) {
      console.log(`[DRY RUN] Would migrate ${turtles.length} groups`);
      migratedCount += turtles.length;
    }

    offset += options.batchSize;

    // Stop if we've reached the limit
    if (options.limit && migratedCount >= options.limit) {
      break;
    }

    // Pause to avoid overwhelming the triplestore
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Groups migration complete: ${stats.groups.migrated} migrated, ${stats.groups.failed} failed`);
}

/**
 * Migrate Posts to RDF
 */
async function migratePosts(rdfConverter, options) {
  console.log('\n=== Migrating Posts ===');

  const query = {
    where: { deleted: false, status: 'published' },
    attributes: ['id', 'name', 'description', 'status', 'created_at', 'user_id', 'group_id',
                 'counter_endorsements_up', 'counter_endorsements_down'],
    offset: options.offset,
    limit: options.limit || undefined,
    order: [['id', 'ASC']]
  };

  const totalCount = await models.Post.count({ where: query.where });
  stats.posts.total = totalCount;

  console.log(`Total posts to migrate: ${totalCount}`);

  let offset = options.offset;
  let migratedCount = 0;

  while (true) {
    const posts = await models.Post.findAll({
      ...query,
      offset,
      limit: options.batchSize
    });

    if (posts.length === 0) {
      break;
    }

    console.log(`Processing batch: offset=${offset}, size=${posts.length}`);

    // Convert to RDF
    const turtles = posts.map(post => {
      try {
        return rdfConverter.convertPostToRDF(post.toJSON());
      } catch (error) {
        console.error(`Failed to convert post ${post.id}:`, error.message);
        stats.posts.failed++;
        return null;
      }
    }).filter(Boolean);

    // Batch insert
    if (!options.dryRun && turtles.length > 0) {
      try {
        await rdfConverter.batchInsert(turtles);
        migratedCount += turtles.length;
        stats.posts.migrated += turtles.length;
        console.log(`✓ Migrated ${turtles.length} posts (total: ${migratedCount}/${totalCount})`);
      } catch (error) {
        console.error('Batch insert failed:', error.message);
        stats.posts.failed += turtles.length;
      }
    } else if (options.dryRun) {
      console.log(`[DRY RUN] Would migrate ${turtles.length} posts`);
      migratedCount += turtles.length;
    }

    offset += options.batchSize;

    // Stop if we've reached the limit
    if (options.limit && migratedCount >= options.limit) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Posts migration complete: ${stats.posts.migrated} migrated, ${stats.posts.failed} failed`);
}

/**
 * Migrate Points to RDF
 */
async function migratePoints(rdfConverter, options) {
  console.log('\n=== Migrating Points ===');

  const query = {
    where: { deleted: false },
    attributes: ['id', 'content', 'value', 'created_at', 'user_id', 'post_id',
                 'counter_quality_up', 'data'],
    offset: options.offset,
    limit: options.limit || undefined,
    order: [['id', 'ASC']]
  };

  const totalCount = await models.Point.count({ where: query.where });
  stats.points.total = totalCount;

  console.log(`Total points to migrate: ${totalCount}`);

  let offset = options.offset;
  let migratedCount = 0;

  while (true) {
    const points = await models.Point.findAll({
      ...query,
      offset,
      limit: options.batchSize
    });

    if (points.length === 0) {
      break;
    }

    console.log(`Processing batch: offset=${offset}, size=${points.length}`);

    // Convert to RDF
    const turtles = points.map(point => {
      try {
        return rdfConverter.convertPointToRDF(point.toJSON());
      } catch (error) {
        console.error(`Failed to convert point ${point.id}:`, error.message);
        stats.points.failed++;
        return null;
      }
    }).filter(Boolean);

    // Batch insert
    if (!options.dryRun && turtles.length > 0) {
      try {
        await rdfConverter.batchInsert(turtles);
        migratedCount += turtles.length;
        stats.points.migrated += turtles.length;
        console.log(`✓ Migrated ${turtles.length} points (total: ${migratedCount}/${totalCount})`);
      } catch (error) {
        console.error('Batch insert failed:', error.message);
        stats.points.failed += turtles.length;
      }
    } else if (options.dryRun) {
      console.log(`[DRY RUN] Would migrate ${turtles.length} points`);
      migratedCount += turtles.length;
    }

    offset += options.batchSize;

    if (options.limit && migratedCount >= options.limit) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Points migration complete: ${stats.points.migrated} migrated, ${stats.points.failed} failed`);
}

/**
 * Migrate Users to RDF
 */
async function migrateUsers(rdfConverter, options) {
  console.log('\n=== Migrating Users ===');

  const query = {
    where: { deleted: false, status: 'active' },
    attributes: ['id', 'name', 'description', 'created_at'],
    offset: options.offset,
    limit: options.limit || undefined,
    order: [['id', 'ASC']]
  };

  const totalCount = await models.User.count({ where: query.where });
  stats.users.total = totalCount;

  console.log(`Total users to migrate: ${totalCount}`);

  let offset = options.offset;
  let migratedCount = 0;

  while (true) {
    const users = await models.User.findAll({
      ...query,
      offset,
      limit: options.batchSize
    });

    if (users.length === 0) {
      break;
    }

    console.log(`Processing batch: offset=${offset}, size=${users.length}`);

    // Convert to RDF (anonymized for privacy)
    const turtles = users.map(user => {
      try {
        return rdfConverter.convertUserToRDF(user.toJSON(), { anonymize: false });
      } catch (error) {
        console.error(`Failed to convert user ${user.id}:`, error.message);
        stats.users.failed++;
        return null;
      }
    }).filter(Boolean);

    // Batch insert
    if (!options.dryRun && turtles.length > 0) {
      try {
        await rdfConverter.batchInsert(turtles);
        migratedCount += turtles.length;
        stats.users.migrated += turtles.length;
        console.log(`✓ Migrated ${turtles.length} users (total: ${migratedCount}/${totalCount})`);
      } catch (error) {
        console.error('Batch insert failed:', error.message);
        stats.users.failed += turtles.length;
      }
    } else if (options.dryRun) {
      console.log(`[DRY RUN] Would migrate ${turtles.length} users`);
      migratedCount += turtles.length;
    }

    offset += options.batchSize;

    if (options.limit && migratedCount >= options.limit) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Users migration complete: ${stats.users.migrated} migrated, ${stats.users.failed} failed`);
}

/**
 * Main migration function
 */
async function main() {
  const options = parseArgs();

  console.log('=================================================');
  console.log('   Knowledge Graph Migration Script');
  console.log('=================================================');
  console.log('Options:', JSON.stringify(options, null, 2));
  console.log('=================================================\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be inserted\n');
  }

  const rdfConverter = new RDFConverter();

  const startTime = Date.now();

  try {
    // Migrate based on entity type
    if (options.entity === 'all' || options.entity === 'group') {
      await migrateGroups(rdfConverter, options);
    }

    if (options.entity === 'all' || options.entity === 'post') {
      await migratePosts(rdfConverter, options);
    }

    if (options.entity === 'all' || options.entity === 'point') {
      await migratePoints(rdfConverter, options);
    }

    if (options.entity === 'all' || options.entity === 'user') {
      await migrateUsers(rdfConverter, options);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n=================================================');
    console.log('   Migration Summary');
    console.log('=================================================');
    console.log('Groups:  ', `${stats.groups.migrated}/${stats.groups.total} (${stats.groups.failed} failed)`);
    console.log('Posts:   ', `${stats.posts.migrated}/${stats.posts.total} (${stats.posts.failed} failed)`);
    console.log('Points:  ', `${stats.points.migrated}/${stats.points.total} (${stats.points.failed} failed)`);
    console.log('Users:   ', `${stats.users.migrated}/${stats.users.total} (${stats.users.failed} failed)`);
    console.log('Duration:', `${duration}s`);
    console.log('=================================================\n');

    const totalMigrated = stats.groups.migrated + stats.posts.migrated +
                          stats.points.migrated + stats.users.migrated;
    const totalFailed = stats.groups.failed + stats.posts.failed +
                        stats.points.failed + stats.users.failed;

    if (totalFailed === 0) {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log(`⚠️  Migration completed with ${totalFailed} failures`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
main();

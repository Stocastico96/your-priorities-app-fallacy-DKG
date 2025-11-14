"use strict";

const express = require('express');
const RDFConverter = require('../services/knowledgeGraph/rdfConverter.cjs');
const log = require('../utils/logger.cjs');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Initialize RDF converter
const rdfConverter = new RDFConverter();

// Rate limiter: 10 queries per minute per user
const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many SPARQL queries, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Whitelist of safe SPARQL query patterns
 * Prevents malicious queries (DELETE, INSERT, DROP, etc.)
 */
const SAFE_QUERY_PATTERNS = [
  /^SELECT/i,
  /^ASK/i,
  /^CONSTRUCT/i,
  /^DESCRIBE/i
];

const FORBIDDEN_PATTERNS = [
  /DELETE/i,
  /INSERT/i,
  /DROP/i,
  /CLEAR/i,
  /CREATE/i,
  /LOAD/i,
  /COPY/i,
  /MOVE/i,
  /ADD/i
];

/**
 * Validate SPARQL query safety
 */
function isQuerySafe(query) {
  const trimmedQuery = query.trim();

  // Check if query starts with safe pattern
  const isSafe = SAFE_QUERY_PATTERNS.some(pattern => pattern.test(trimmedQuery));
  if (!isSafe) {
    return { safe: false, reason: 'Query must start with SELECT, ASK, CONSTRUCT, or DESCRIBE' };
  }

  // Check for forbidden operations
  const hasForbidden = FORBIDDEN_PATTERNS.some(pattern => pattern.test(trimmedQuery));
  if (hasForbidden) {
    return { safe: false, reason: 'Query contains forbidden operations (DELETE, INSERT, etc.)' };
  }

  return { safe: true };
}

/**
 * GET /api/knowledge-graph/query
 *
 * Execute a SPARQL query against the knowledge graph
 *
 * Query params:
 * - sparql: SPARQL query string (required)
 * - format: Response format (json, turtle, xml) - default: json
 *
 * Example:
 * GET /api/knowledge-graph/query?sparql=SELECT * WHERE { ?s ?p ?o } LIMIT 10&format=json
 */
router.get('/query', queryLimiter, async (req, res) => {
  try {
    const { sparql, format = 'json' } = req.query;

    if (!sparql) {
      return res.status(400).json({
        error: 'Missing required parameter: sparql'
      });
    }

    // Validate query safety
    const safety = isQuerySafe(sparql);
    if (!safety.safe) {
      log.warn('Unsafe SPARQL query blocked', {
        query: sparql,
        reason: safety.reason,
        user: req.user?.id
      });

      return res.status(403).json({
        error: 'Forbidden query',
        reason: safety.reason
      });
    }

    log.info('Executing SPARQL query', {
      query: sparql.substring(0, 100),
      format,
      user: req.user?.id
    });

    // Execute query
    const result = await rdfConverter.query(sparql);

    if (!result.success) {
      return res.status(500).json({
        error: 'Query execution failed',
        details: result.error
      });
    }

    // Return results in requested format
    if (format === 'json') {
      return res.json(result.results);
    } else if (format === 'turtle' || format === 'xml') {
      // For non-JSON formats, return raw results
      return res.type(format).send(result.results);
    } else {
      return res.status(400).json({
        error: 'Invalid format. Supported: json, turtle, xml'
      });
    }

  } catch (error) {
    log.error('Knowledge graph query error', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/knowledge-graph/query
 *
 * Execute a SPARQL query (POST method for complex queries)
 *
 * Body:
 * {
 *   "sparql": "SELECT ...",
 *   "format": "json"
 * }
 */
router.post('/query', queryLimiter, async (req, res) => {
  try {
    const { sparql, format = 'json' } = req.body;

    if (!sparql) {
      return res.status(400).json({
        error: 'Missing required field: sparql'
      });
    }

    // Validate query safety
    const safety = isQuerySafe(sparql);
    if (!safety.safe) {
      log.warn('Unsafe SPARQL query blocked', {
        query: sparql,
        reason: safety.reason,
        user: req.user?.id
      });

      return res.status(403).json({
        error: 'Forbidden query',
        reason: safety.reason
      });
    }

    log.info('Executing SPARQL query (POST)', {
      query: sparql.substring(0, 100),
      format,
      user: req.user?.id
    });

    // Execute query
    const result = await rdfConverter.query(sparql);

    if (!result.success) {
      return res.status(500).json({
        error: 'Query execution failed',
        details: result.error
      });
    }

    return res.json(result.results);

  } catch (error) {
    log.error('Knowledge graph query error', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/knowledge-graph/examples
 *
 * Returns example SPARQL queries
 */
router.get('/examples', (req, res) => {
  const examples = [
    {
      name: 'All Deliberation Processes',
      description: 'List all deliberation processes (groups)',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process ?title ?status
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title ;
           delib:processStatus ?status .
}
LIMIT 100`
    },
    {
      name: 'Arguments on a Topic',
      description: 'Find all arguments (for and against) on a specific post',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?argument ?description ?type
WHERE {
  ?argument a delib:Argument ;
            dc:description ?description ;
            delib:argumentType ?type .
  FILTER(?argument = <http://yourpriorities.org/kg/post/123>)
}
LIMIT 50`
    },
    {
      name: 'Participant Contributions',
      description: 'Get all contributions by a specific participant',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?contribution ?title ?created
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?contribution delib:hasAuthor ?participant ;
                dc:title ?title ;
                dcterms:created ?created .
}
ORDER BY DESC(?created)
LIMIT 50`
    },
    {
      name: 'Related Deliberations',
      description: 'Find related deliberation processes based on shared participants',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process1 ?process2 (COUNT(?participant) as ?sharedParticipants)
WHERE {
  ?contribution1 delib:contributesTo ?process1 ;
                 delib:hasAuthor ?participant .
  ?contribution2 delib:contributesTo ?process2 ;
                 delib:hasAuthor ?participant .
  FILTER(?process1 != ?process2)
}
GROUP BY ?process1 ?process2
HAVING (COUNT(?participant) > 2)
ORDER BY DESC(?sharedParticipants)
LIMIT 20`
    },
    {
      name: 'Fallacy Detection Statistics',
      description: 'Count fallacies by type',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>

SELECT ?fallacyType (COUNT(?fallacy) as ?count)
WHERE {
  ?fallacy a delib:Fallacy ;
           delib:fallacyType ?fallacyType .
}
GROUP BY ?fallacyType
ORDER BY DESC(?count)`
    },
    {
      name: 'Most Active Participants',
      description: 'Rank participants by number of contributions',
      sparql: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant ?name (COUNT(?contribution) as ?contributionCount)
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?contribution delib:hasAuthor ?participant .
}
GROUP BY ?participant ?name
ORDER BY DESC(?contributionCount)
LIMIT 20`
    }
  ];

  res.json({
    examples,
    usage: 'Use these examples as templates for your own queries. Replace placeholder values as needed.'
  });
});

/**
 * GET /api/knowledge-graph/stats
 *
 * Get statistics about the knowledge graph
 */
router.get('/stats', async (req, res) => {
  try {
    const queries = {
      processes: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
                  SELECT (COUNT(?p) as ?count) WHERE { ?p a delib:DeliberationProcess }`,

      contributions: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
                      SELECT (COUNT(?c) as ?count) WHERE { ?c a delib:Contribution }`,

      arguments: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
                  SELECT (COUNT(?a) as ?count) WHERE { ?a a delib:Argument }`,

      participants: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
                     SELECT (COUNT(?p) as ?count) WHERE { ?p a delib:Participant }`,

      fallacies: `PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
                  SELECT (COUNT(?f) as ?count) WHERE { ?f a delib:Fallacy }`
    };

    const stats = {};

    for (const [key, query] of Object.entries(queries)) {
      const result = await rdfConverter.query(query);
      if (result.success && result.results?.results?.bindings?.length > 0) {
        stats[key] = parseInt(result.results.results.bindings[0].count.value) || 0;
      } else {
        stats[key] = 0;
      }
    }

    res.json({
      knowledgeGraphStats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Failed to get KG stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Simple ping query
    const result = await rdfConverter.query('SELECT * WHERE { ?s ?p ?o } LIMIT 1');

    if (result.success) {
      res.json({
        status: 'healthy',
        fusekiUrl: rdfConverter.fusekiUrl,
        dataset: rdfConverter.dataset
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        error: result.error
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;

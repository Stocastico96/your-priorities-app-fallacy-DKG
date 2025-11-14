# Knowledge Graph Integration - Setup & Testing Guide

This guide covers the complete setup and testing of the Knowledge Graph infrastructure for Your Priorities deliberative democracy platform.

## Overview

The Knowledge Graph integration enables semantic representation of deliberation data using RDF triples, allowing for advanced queries and analysis of:
- Deliberation processes and their relationships
- Arguments, proposals, and participant contributions
- Fallacy detection and argument quality
- Cross-process insights and patterns

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Your Priorities App                     │
│                                                           │
│  ┌──────────┐      ┌─────────────┐     ┌─────────────┐ │
│  │PostgreSQL│─────▶│ RDF         │────▶│   Apache    │ │
│  │ Database │      │ Converter   │     │   Fuseki    │ │
│  └──────────┘      └─────────────┘     │ Triplestore │ │
│       │                                 └─────────────┘ │
│       │                                        │         │
│  ┌──────────┐                          ┌─────────────┐ │
│  │ DB Hooks │                          │   SPARQL    │ │
│  │(real-time)                          │    API      │ │
│  └──────────┘                          └─────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Triplestore Setup

### 1.1 Prerequisites

- Docker and Docker Compose installed
- Node.js 22.15.0
- PostgreSQL database with existing Your Priorities data
- At least 4GB RAM available for Fuseki

### 1.2 Start Apache Jena Fuseki

```bash
# Create data directory
mkdir -p ./data/fuseki

# Optional: Set custom admin password
export FUSEKI_ADMIN_PASSWORD=your-secure-password

# Start Fuseki
docker-compose -f docker-compose.fuseki.yml up -d

# Check logs
docker logs -f your-priorities-fuseki
```

### 1.3 Access Fuseki UI

Open your browser and navigate to: **http://localhost:3030**

- Username: `admin`
- Password: `admin123` (or your custom password)

### 1.4 Create Dataset

**Option A: Via UI**
1. Go to "Manage datasets" → "Add new dataset"
2. Dataset name: `deliberation`
3. Dataset type: **Persistent (TDB2)**
4. Click "Create dataset"

**Option B: Via Command Line**
```bash
curl -X POST http://localhost:3030/$/datasets \
  -u admin:admin123 \
  --data "dbName=deliberation&dbType=tdb2"
```

### 1.5 Load Ontology

```bash
# Load the Deliberation Ontology
curl -X POST -u admin:admin123 \
  -H "Content-Type: text/turtle" \
  --data-binary @server_api/src/services/knowledgeGraph/ontology/deliberation-ontology.ttl \
  http://localhost:3030/deliberation/data
```

Verify ontology loaded:
```bash
curl -X POST http://localhost:3030/deliberation/query \
  --data-urlencode "query=SELECT * WHERE { ?s ?p ?o } LIMIT 10"
```

## Phase 2: Configure Your Priorities

### 2.1 Environment Variables

Add to your `.env` file:

```bash
# Knowledge Graph Configuration
KG_SYNC_ENABLED=true
FUSEKI_URL=http://localhost:3030
FUSEKI_ADMIN_PASSWORD=your-secure-password
FUSEKI_WRITE_API_KEY=your-write-api-key
BASE_URI=http://yourpriorities.org/kg/
```

### 2.2 Install Dependencies

The required packages are already in package.json:
- `axios` - for HTTP requests to Fuseki

```bash
cd server_api
npm install
```

### 2.3 Enable Knowledge Graph Hooks

Add to your main app initialization file (`server_api/src/app.ts`):

```javascript
// Import KG hooks
const { initializeKnowledgeGraphHooks } = require('./services/knowledgeGraph/hooks.cjs');

// After models are loaded (after sequelize initialization)
initializeKnowledgeGraphHooks(sequelize);
```

### 2.4 Register API Routes

Add to your router configuration (`server_api/src/app.ts`):

```javascript
const knowledgeGraphRouter = require('./controllers/knowledgeGraph.cjs');

// Register routes
app.use('/api/knowledge-graph', knowledgeGraphRouter);
```

## Phase 3: Initial Data Migration

### 3.1 Test Migration (Dry Run)

Test with a small sample first:

```bash
cd server_api
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity post \
  --limit 100 \
  --dry-run
```

### 3.2 Migrate Specific Entity Type

```bash
# Migrate all posts
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity post \
  --batch-size 1000

# Migrate all groups
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity group

# Migrate all points (arguments)
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity point

# Migrate all users
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity user
```

### 3.3 Full Migration

Migrate all data types:

```bash
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity all \
  --batch-size 1000
```

### 3.4 Resume Interrupted Migration

If migration is interrupted, resume from a specific offset:

```bash
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity post \
  --offset 5000
```

## Phase 4: Testing

### 4.1 Health Check

```bash
curl http://localhost:8000/api/knowledge-graph/health
```

Expected response:
```json
{
  "status": "healthy",
  "fusekiUrl": "http://localhost:3030",
  "dataset": "deliberation"
}
```

### 4.2 Get Statistics

```bash
curl http://localhost:8000/api/knowledge-graph/stats
```

Expected response:
```json
{
  "knowledgeGraphStats": {
    "processes": 150,
    "contributions": 1250,
    "arguments": 3400,
    "participants": 890,
    "fallacies": 45
  },
  "timestamp": "2025-01-14T10:30:00.000Z"
}
```

### 4.3 Example Queries

#### Query 1: List All Deliberation Processes

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> PREFIX dc: <http://purl.org/dc/elements/1.1/> SELECT ?process ?title ?status WHERE { ?process a delib:DeliberationProcess ; dc:title ?title ; delib:processStatus ?status . } LIMIT 10",
    "format": "json"
  }'
```

#### Query 2: Find Arguments on a Specific Post

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> PREFIX dc: <http://purl.org/dc/elements/1.1/> PREFIX yp: <http://yourpriorities.org/kg/> SELECT ?argument ?description ?type WHERE { ?argument a delib:Argument ; dc:description ?description ; delib:argumentType ?type . { ?argument delib:supports <http://yourpriorities.org/kg/post/123> } UNION { ?argument delib:opposes <http://yourpriorities.org/kg/post/123> } }",
    "format": "json"
  }'
```

#### Query 3: Most Active Participants

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?participant ?name (COUNT(?contribution) as ?count) WHERE { ?participant a delib:Participant ; foaf:name ?name . ?contribution delib:hasAuthor ?participant . } GROUP BY ?participant ?name ORDER BY DESC(?count) LIMIT 20",
    "format": "json"
  }'
```

#### Query 4: Related Deliberations

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> SELECT ?process1 ?process2 (COUNT(?participant) as ?sharedParticipants) WHERE { ?contribution1 delib:contributesTo ?process1 ; delib:hasAuthor ?participant . ?contribution2 delib:contributesTo ?process2 ; delib:hasAuthor ?participant . FILTER(?process1 != ?process2) } GROUP BY ?process1 ?process2 HAVING (COUNT(?participant) > 2) ORDER BY DESC(?sharedParticipants) LIMIT 20",
    "format": "json"
  }'
```

#### Query 5: Fallacy Statistics

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> SELECT ?fallacyType (COUNT(?fallacy) as ?count) WHERE { ?fallacy a delib:Fallacy ; delib:fallacyType ?fallacyType . } GROUP BY ?fallacyType ORDER BY DESC(?count)",
    "format": "json"
  }'
```

### 4.4 Get Example Queries

```bash
curl http://localhost:8000/api/knowledge-graph/examples
```

This returns a list of pre-built example queries with descriptions.

### 4.5 Test Real-time Sync

Create a new post via Your Priorities UI or API, then verify it appears in the knowledge graph:

```bash
# Replace POST_ID with the actual post ID
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX yp: <http://yourpriorities.org/kg/> SELECT * WHERE { <http://yourpriorities.org/kg/post/POST_ID> ?p ?o }",
    "format": "json"
  }'
```

## Phase 5: Advanced Features

### 5.1 Direct SPARQL Queries via Fuseki

For advanced users, query Fuseki directly:

```bash
# Query endpoint
curl -X POST http://localhost:3030/deliberation/query \
  --data-urlencode "query=SELECT * WHERE { ?s ?p ?o } LIMIT 10"

# SPARQL Update (requires authentication)
curl -X POST -u admin:admin123 \
  http://localhost:3030/deliberation/update \
  -H "Content-Type: application/sparql-update" \
  --data "INSERT DATA { <http://example.org/test> <http://example.org/prop> \"value\" }"
```

### 5.2 Backup and Restore

**Backup:**
```bash
# Export all triples
curl "http://localhost:3030/deliberation/data?graph=default" > backup.ttl

# Or backup the entire database directory
docker-compose -f docker-compose.fuseki.yml down
tar -czf fuseki-backup-$(date +%Y%m%d).tar.gz ./data/fuseki
docker-compose -f docker-compose.fuseki.yml up -d
```

**Restore:**
```bash
# Stop Fuseki
docker-compose -f docker-compose.fuseki.yml down

# Restore backup
tar -xzf fuseki-backup-YYYYMMDD.tar.gz

# Restart Fuseki
docker-compose -f docker-compose.fuseki.yml up -d
```

### 5.3 Monitoring

Check Fuseki statistics:
```bash
curl http://localhost:3030/$/stats/deliberation
```

View active queries:
```bash
curl http://localhost:3030/$/tasks
```

## Troubleshooting

### Issue: Cannot connect to Fuseki

**Solution:**
```bash
# Check if Fuseki is running
docker ps | grep fuseki

# Check logs
docker logs your-priorities-fuseki

# Restart Fuseki
docker-compose -f docker-compose.fuseki.yml restart
```

### Issue: Migration fails with memory errors

**Solution:**
```bash
# Reduce batch size
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity post \
  --batch-size 500
```

### Issue: SPARQL queries timeout

**Solution:**
1. Increase JVM memory in docker-compose.fuseki.yml:
   ```yaml
   environment:
     - JVM_ARGS=-Xmx4g  # Increase to 4GB
   ```

2. Add query complexity limits in your queries:
   ```sparql
   SELECT * WHERE { ... } LIMIT 100
   ```

### Issue: Rate limiting errors

**Solution:**
The API has rate limiting (10 queries/minute). For testing, you can:
1. Wait 1 minute between query batches
2. Increase rate limits in `knowledgeGraph.cjs`
3. Use direct Fuseki endpoint (no rate limiting)

## Security Considerations

### Production Deployment

1. **Change default passwords:**
   ```bash
   export FUSEKI_ADMIN_PASSWORD=strong-random-password
   ```

2. **Enable authentication for write operations:**
   - Set `FUSEKI_WRITE_API_KEY` in .env
   - Only authenticated requests can modify data

3. **Use HTTPS:**
   - Deploy Fuseki behind nginx with SSL
   - See `docker-compose.fuseki.yml` for nginx configuration

4. **Network isolation:**
   - Use Docker networks to isolate Fuseki
   - Only expose SPARQL query endpoint publicly
   - Keep update endpoint internal

5. **Anonymize user data:**
   - In `rdfConverter.cjs`, set `anonymize: true` when converting users
   - Only export public profile data

## Performance Optimization

### Indexing

Fuseki automatically indexes common predicates. For custom indexes:

```sparql
# Add custom index (requires admin access)
PREFIX text: <http://jena.apache.org/text#>
INSERT DATA {
  [] text:createIndex (
    [ a text:TextIndexLucene ;
      text:directory <file:///fuseki/indexes/deliberation> ;
      text:entityMap [ ... ]
    ]
  )
}
```

### Caching

Enable query result caching:
```bash
# Add to docker-compose.fuseki.yml environment
- FUSEKI_CACHE_SIZE=1000
```

### Query Optimization

1. Always use LIMIT in queries
2. Filter early: use FILTER close to the triple it filters
3. Use specific predicates instead of `?p`
4. Order by indexed properties

## Next Steps

1. **Fallacy Detection Integration:** Connect fallacy detection to automatically populate `delib:containsFallacy` relationships

2. **Visualization:** Build a graph visualization UI using D3.js or Cytoscape.js

3. **Cross-Platform Integration:** Import data from other deliberation platforms (Decidim, Consul, etc.)

4. **Semantic Search:** Implement semantic similarity search using embeddings

5. **Analytics Dashboard:** Create real-time analytics using knowledge graph queries

## Additional Resources

- [Apache Jena Fuseki Documentation](https://jena.apache.org/documentation/fuseki2/)
- [SPARQL 1.1 Query Language](https://www.w3.org/TR/sparql11-query/)
- [RDF 1.1 Turtle](https://www.w3.org/TR/turtle/)
- [Deliberation Ontology Reference](http://stocastico96.github.io/Deliberation-Knowledge-Graph/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Fuseki logs: `docker logs your-priorities-fuseki`
3. Test queries via Fuseki UI: http://localhost:3030
4. Open an issue on GitHub with logs and error details

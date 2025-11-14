# Knowledge Graph - Quick Start Guide

This is a **5-minute quick start** to get the Knowledge Graph running.

For detailed documentation, see [KNOWLEDGE_GRAPH_SETUP.md](./KNOWLEDGE_GRAPH_SETUP.md).

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0
- Your Priorities app running

## Step 1: Start Fuseki (2 minutes)

```bash
# Create data directory
mkdir -p ./data/fuseki

# Start Apache Jena Fuseki
docker-compose -f docker-compose.fuseki.yml up -d

# Wait for it to start (check logs)
docker logs -f your-priorities-fuseki
# Press Ctrl+C when you see "Fuseki Server started"
```

**Access Fuseki UI:** http://localhost:3030
- Username: `admin`
- Password: `admin123`

## Step 2: Create Dataset & Load Ontology (1 minute)

```bash
# Create dataset
curl -X POST http://localhost:3030/$/datasets \
  -u admin:admin123 \
  --data "dbName=deliberation&dbType=tdb2"

# Load ontology
curl -X POST -u admin:admin123 \
  -H "Content-Type: text/turtle" \
  --data-binary @server_api/src/services/knowledgeGraph/ontology/deliberation-ontology.ttl \
  http://localhost:3030/deliberation/data
```

## Step 3: Configure Your Priorities (1 minute)

Add to `.env`:

```bash
KG_SYNC_ENABLED=true
FUSEKI_URL=http://localhost:3030
FUSEKI_ADMIN_PASSWORD=admin123
BASE_URI=http://yourpriorities.org/kg/
```

Add to `server_api/src/app.ts` (after sequelize initialization):

```javascript
// Import KG hooks
const { initializeKnowledgeGraphHooks } = require('./services/knowledgeGraph/hooks.cjs');

// Initialize hooks (after models are loaded)
initializeKnowledgeGraphHooks(sequelize);

// Register API routes
const knowledgeGraphRouter = require('./controllers/knowledgeGraph.cjs');
app.use('/api/knowledge-graph', knowledgeGraphRouter);
```

Restart your app:
```bash
npm run dev
```

## Step 4: Migrate Data (1-10 minutes)

```bash
cd server_api

# Test with small sample first
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity post \
  --limit 100

# Migrate all (may take a few minutes)
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs \
  --entity all \
  --batch-size 1000
```

## Step 5: Test & Query (1 minute)

### Health Check

```bash
curl http://localhost:8000/api/knowledge-graph/health
```

### Get Statistics

```bash
curl http://localhost:8000/api/knowledge-graph/stats
```

### Run Example Query

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> PREFIX dc: <http://purl.org/dc/elements/1.1/> SELECT ?process ?title WHERE { ?process a delib:DeliberationProcess ; dc:title ?title . } LIMIT 10"
  }'
```

## That's It! 🎉

Your Knowledge Graph is now running and syncing with Your Priorities.

### What You Can Do Now

1. **Explore via Fuseki UI:** http://localhost:3030
   - Click "Query" to run SPARQL queries
   - See pre-loaded ontology and data

2. **Use the API:**
   - GET `/api/knowledge-graph/examples` - See example queries
   - POST `/api/knowledge-graph/query` - Run custom queries
   - GET `/api/knowledge-graph/stats` - Get statistics

3. **View Example Queries:**
   - See `server_api/src/services/knowledgeGraph/EXAMPLE_QUERIES.md`
   - 25+ ready-to-use SPARQL queries

4. **Real-time Sync:**
   - Create a new post in Your Priorities
   - It automatically appears in the Knowledge Graph

## Example Queries to Try

### List All Deliberation Processes

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process ?title ?status
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title ;
           delib:processStatus ?status .
}
LIMIT 20
```

### Most Active Participants

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant ?name (COUNT(?contribution) as ?count)
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?contribution delib:hasAuthor ?participant .
}
GROUP BY ?participant ?name
ORDER BY DESC(?count)
LIMIT 10
```

### Find Arguments on a Post

Replace `123` with actual post ID:

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?argument ?description ?type
WHERE {
  ?argument a delib:Argument ;
            dc:description ?description ;
            delib:argumentType ?type .
  { ?argument delib:supports <http://yourpriorities.org/kg/post/123> }
  UNION
  { ?argument delib:opposes <http://yourpriorities.org/kg/post/123> }
}
```

## Troubleshooting

### Fuseki won't start
```bash
# Check logs
docker logs your-priorities-fuseki

# Restart
docker-compose -f docker-compose.fuseki.yml restart
```

### Migration fails
```bash
# Use smaller batch size
node migrateToKnowledgeGraph.cjs --entity post --batch-size 500

# Resume from offset if interrupted
node migrateToKnowledgeGraph.cjs --entity post --offset 5000
```

### Query returns empty
- Check migration completed: `curl http://localhost:8000/api/knowledge-graph/stats`
- Verify dataset created: http://localhost:3030/$/datasets
- Check ontology loaded: Run query `SELECT * WHERE { ?s ?p ?o } LIMIT 10`

## Next Steps

- **Read full documentation:** [KNOWLEDGE_GRAPH_SETUP.md](./KNOWLEDGE_GRAPH_SETUP.md)
- **Explore example queries:** `server_api/src/services/knowledgeGraph/EXAMPLE_QUERIES.md`
- **Learn the ontology:** `server_api/src/services/knowledgeGraph/ontology/deliberation-ontology.ttl`
- **Build visualizations:** Use SPARQL queries to power dashboards
- **Integrate fallacy detection:** Connect to populate `delib:containsFallacy` relationships

## Resources

- **Fuseki UI:** http://localhost:3030
- **API Docs:** http://localhost:8000/api/knowledge-graph/examples
- **SPARQL Tutorial:** https://www.w3.org/TR/sparql11-query/
- **Apache Jena Docs:** https://jena.apache.org/documentation/fuseki2/

## Support

For detailed help, see:
- [KNOWLEDGE_GRAPH_SETUP.md](./KNOWLEDGE_GRAPH_SETUP.md) - Complete setup guide
- [server_api/src/services/knowledgeGraph/README.md](./server_api/src/services/knowledgeGraph/README.md) - Developer docs
- [EXAMPLE_QUERIES.md](./server_api/src/services/knowledgeGraph/EXAMPLE_QUERIES.md) - Query examples

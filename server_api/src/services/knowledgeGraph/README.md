# Knowledge Graph Service

Semantic representation of Your Priorities deliberation data using RDF and SPARQL.

## Overview

This service converts Your Priorities entities (Groups, Posts, Points, Users) into RDF triples following the Deliberation Ontology, enabling:

- **Semantic queries** across deliberation data
- **Cross-process analysis** and pattern discovery
- **Argument structure** representation
- **Fallacy detection** integration
- **Linked open data** publishing

## Architecture

```
PostgreSQL Database
        │
        │ (Database Hooks)
        ▼
   RDF Converter ────────▶ Apache Jena Fuseki
        │                    (Triplestore)
        │                          │
        ▼                          │
    Job Queue                      │
                                   ▼
                            SPARQL Endpoint
                                   │
                                   ▼
                            Knowledge Graph API
```

## Components

### 1. RDF Converter (`rdfConverter.cjs`)

Converts database entities to RDF triples in Turtle format.

**Supported conversions:**
- `Group` → `delib:DeliberationProcess`
- `Post` → `delib:Contribution`, `delib:Proposal`
- `Point` → `delib:Argument`
- `User` → `delib:Participant`, `foaf:Person`

**Example usage:**
```javascript
const RDFConverter = require('./rdfConverter.cjs');
const converter = new RDFConverter();

// Convert a group
const turtle = converter.convertGroupToRDF(group);

// Insert to triplestore
await converter.insertRDF(turtle);

// Query
const result = await converter.query('SELECT * WHERE { ?s ?p ?o } LIMIT 10');
```

### 2. Database Hooks (`hooks.cjs`)

Automatically syncs database changes to the knowledge graph in real-time.

**Features:**
- Asynchronous job queue (doesn't block requests)
- Automatic retry on failure
- Selective sync (only important field changes)
- Feature flag control (`KG_SYNC_ENABLED`)

**Setup:**
```javascript
const { initializeKnowledgeGraphHooks } = require('./services/knowledgeGraph/hooks.cjs');
initializeKnowledgeGraphHooks(sequelize);
```

### 3. SPARQL Query API (`../controllers/knowledgeGraph.cjs`)

REST API for querying the knowledge graph.

**Endpoints:**

- `GET/POST /api/knowledge-graph/query` - Execute SPARQL queries
- `GET /api/knowledge-graph/examples` - Get example queries
- `GET /api/knowledge-graph/stats` - Get KG statistics
- `GET /api/knowledge-graph/health` - Health check

**Security:**
- Rate limiting (10 queries/min)
- Query whitelisting (SELECT, ASK, CONSTRUCT, DESCRIBE only)
- No destructive operations (DELETE, INSERT blocked)

### 4. Migration Script (`../scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs`)

Bulk migration of existing data to the knowledge graph.

**Usage:**
```bash
# Migrate all posts
node migrateToKnowledgeGraph.cjs --entity post

# Migrate with custom batch size
node migrateToKnowledgeGraph.cjs --entity all --batch-size 500

# Resume from offset
node migrateToKnowledgeGraph.cjs --entity post --offset 5000

# Dry run (test)
node migrateToKnowledgeGraph.cjs --entity post --limit 100 --dry-run
```

### 5. Ontology (`ontology/deliberation-ontology.ttl`)

The Deliberation Ontology defines the vocabulary for representing deliberation data.

**Main classes:**
- `delib:DeliberationProcess` - A deliberation process
- `delib:Contribution` - A contribution (abstract)
- `delib:Proposal` - A proposal/idea
- `delib:Argument` - An argument (for/against)
- `delib:Participant` - A participant
- `delib:Fallacy` - A logical fallacy

**Main properties:**
- `delib:contributesTo` - Links contribution to process
- `delib:hasAuthor` - Links contribution to participant
- `delib:supports` - Argument supports proposal
- `delib:opposes` - Argument opposes proposal
- `delib:containsFallacy` - Argument contains fallacy

## Quick Start

### 1. Start Fuseki

```bash
docker-compose -f docker-compose.fuseki.yml up -d
```

### 2. Load Ontology

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: text/turtle" \
  --data-binary @ontology/deliberation-ontology.ttl \
  http://localhost:3030/deliberation/data
```

### 3. Migrate Data

```bash
node src/scripts/knowledgeGraph/migrateToKnowledgeGraph.cjs --entity all
```

### 4. Query

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#> SELECT * WHERE { ?s a delib:DeliberationProcess } LIMIT 10"
  }'
```

## Configuration

Add to `.env`:

```bash
KG_SYNC_ENABLED=true
FUSEKI_URL=http://localhost:3030
FUSEKI_ADMIN_PASSWORD=your-password
FUSEKI_WRITE_API_KEY=your-api-key
BASE_URI=http://yourpriorities.org/kg/
```

## Example Queries

See `EXAMPLE_QUERIES.md` for 25+ ready-to-use SPARQL queries, including:

- List all deliberation processes
- Find arguments on a topic
- Most active participants
- Related deliberations
- Fallacy statistics
- Argument quality analysis
- Network analysis

## API Examples

### Get all deliberation processes

```javascript
const response = await fetch('/api/knowledge-graph/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sparql: `
      PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
      PREFIX dc: <http://purl.org/dc/elements/1.1/>

      SELECT ?process ?title ?status
      WHERE {
        ?process a delib:DeliberationProcess ;
                 dc:title ?title ;
                 delib:processStatus ?status .
      }
      LIMIT 10
    `
  })
});

const data = await response.json();
```

### Get arguments for a post

```javascript
const postId = 123;
const response = await fetch('/api/knowledge-graph/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sparql: `
      PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      PREFIX yp: <http://yourpriorities.org/kg/>

      SELECT ?argument ?description ?type
      WHERE {
        ?argument a delib:Argument ;
                  dc:description ?description ;
                  delib:argumentType ?type .
        {
          ?argument delib:supports <http://yourpriorities.org/kg/post/${postId}> .
        }
        UNION
        {
          ?argument delib:opposes <http://yourpriorities.org/kg/post/${postId}> .
        }
      }
    `
  })
});

const arguments = await response.json();
```

## Performance Considerations

### Optimization Tips

1. **Always use LIMIT** in queries
2. **Filter early** in WHERE clauses
3. **Use specific predicates** instead of `?p`
4. **Batch operations** during migration
5. **Cache frequent queries** on application level

### Indexing

Fuseki automatically indexes:
- RDF types (`rdf:type`)
- Common predicates
- Literal values

For custom indexes, modify Fuseki configuration.

### Scaling

For large datasets (>10M triples):
- Increase JVM memory: `-Xmx4g` or higher
- Use TDB2 (transaction support)
- Consider sharding by community/domain
- Use SPARQL federation for distributed queries

## Monitoring

### Health Check

```bash
curl http://localhost:8000/api/knowledge-graph/health
```

### Statistics

```bash
curl http://localhost:8000/api/knowledge-graph/stats
```

### Fuseki Admin

```bash
# Server stats
curl http://localhost:3030/$/stats/deliberation

# Active tasks
curl http://localhost:3030/$/tasks

# Ping
curl http://localhost:3030/$/ping
```

## Troubleshooting

### Issue: RDF conversion fails

**Check:** Entity has all required fields
**Solution:** Add null checks in converter methods

### Issue: SPARQL query timeout

**Solution:**
- Add LIMIT to query
- Increase Fuseki memory
- Optimize query (filter early, use specific predicates)

### Issue: Sync lag

**Check:** Job queue status
**Solution:**
- Increase worker concurrency
- Check Fuseki performance
- Review error logs

## Development

### Adding a New Entity Type

1. **Add conversion method** in `rdfConverter.cjs`:
   ```javascript
   convertNewEntityToRDF(entity) {
     const uri = this.uri('newentity', entity.id);
     let turtle = `${this.getTurtlePrefixes()}\n\n`;
     turtle += `<${uri}> a delib:NewEntityClass ;\n`;
     // Add properties...
     return turtle;
   }
   ```

2. **Add database hook** in `hooks.cjs`:
   ```javascript
   function addNewEntityHooks(NewEntity) {
     NewEntity.afterCreate((entity, options) => {
       queueRDFConversion('NewEntity', entity.toJSON(), 'create');
     });
   }
   ```

3. **Update migration script** with new entity logic

4. **Test conversion**:
   ```javascript
   const entity = await models.NewEntity.findByPk(1);
   const turtle = converter.convertNewEntityToRDF(entity);
   console.log(turtle);
   ```

## Testing

### Unit Tests

```bash
npm test -- services/knowledgeGraph/rdfConverter.test.js
```

### Integration Tests

```bash
# Start Fuseki
docker-compose -f docker-compose.fuseki.yml up -d

# Run tests
npm test -- integration/knowledgeGraph.test.js
```

### Manual Testing

See `KNOWLEDGE_GRAPH_SETUP.md` for comprehensive testing instructions.

## Resources

- [Full Setup Guide](../../../../KNOWLEDGE_GRAPH_SETUP.md)
- [Example Queries](./EXAMPLE_QUERIES.md)
- [Deliberation Ontology](./ontology/deliberation-ontology.ttl)
- [Apache Jena Fuseki Docs](https://jena.apache.org/documentation/fuseki2/)
- [SPARQL 1.1 Spec](https://www.w3.org/TR/sparql11-query/)

## License

MIT - See LICENSE.md

## Support

For issues:
1. Check `KNOWLEDGE_GRAPH_SETUP.md` troubleshooting section
2. Review logs: `docker logs your-priorities-fuseki`
3. Test via Fuseki UI: http://localhost:3030
4. Open GitHub issue with details

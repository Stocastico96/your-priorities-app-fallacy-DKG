# Knowledge Graph - Example SPARQL Queries

This document contains ready-to-use SPARQL queries for the Your Priorities Knowledge Graph.

## Basic Queries

### 1. Count all entities

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>

SELECT ?type (COUNT(?entity) as ?count)
WHERE {
  ?entity a ?type .
  FILTER(STRSTARTS(STR(?type), "http://www.semanticweb.org/deliberation-ontology#"))
}
GROUP BY ?type
ORDER BY DESC(?count)
```

### 2. List all deliberation processes

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?process ?title ?status ?created
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title ;
           delib:processStatus ?status ;
           dcterms:created ?created .
}
ORDER BY DESC(?created)
LIMIT 50
```

### 3. Get details of a specific post

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?property ?value
WHERE {
  <http://yourpriorities.org/kg/post/123> ?property ?value .
}
```

## Argument Analysis

### 4. Find all supporting arguments for a proposal

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?argument ?description ?quality ?author
WHERE {
  ?argument a delib:Argument ;
            delib:supports <http://yourpriorities.org/kg/post/123> ;
            dc:description ?description ;
            delib:qualityScore ?quality ;
            delib:hasAuthor ?author .
}
ORDER BY DESC(?quality)
LIMIT 20
```

### 5. Find all opposing arguments for a proposal

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?argument ?description ?quality ?author
WHERE {
  ?argument a delib:Argument ;
            delib:opposes <http://yourpriorities.org/kg/post/123> ;
            dc:description ?description ;
            delib:qualityScore ?quality ;
            delib:hasAuthor ?author .
}
ORDER BY DESC(?quality)
LIMIT 20
```

### 6. Compare support vs opposition

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT
  (COUNT(?supportArg) as ?supportCount)
  (COUNT(?opposeArg) as ?opposeCount)
WHERE {
  {
    ?supportArg delib:supports <http://yourpriorities.org/kg/post/123> .
  }
  UNION
  {
    ?opposeArg delib:opposes <http://yourpriorities.org/kg/post/123> .
  }
}
```

### 7. Highest quality arguments across all posts

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?argument ?description ?quality ?type
WHERE {
  ?argument a delib:Argument ;
            dc:description ?description ;
            delib:qualityScore ?quality ;
            delib:argumentType ?type .
  FILTER(?quality > 10)
}
ORDER BY DESC(?quality)
LIMIT 50
```

## Participant Analysis

### 8. Most active participants

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant ?name (COUNT(?contribution) as ?contributionCount)
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?contribution delib:hasAuthor ?participant .
}
GROUP BY ?participant ?name
ORDER BY DESC(?contributionCount)
LIMIT 20
```

### 9. Participant contribution history

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?contribution ?type ?title ?created
WHERE {
  ?contribution delib:hasAuthor <http://yourpriorities.org/kg/user/456> ;
                a ?type ;
                dc:title ?title ;
                dcterms:created ?created .
  FILTER(?type = delib:Proposal || ?type = delib:Argument)
}
ORDER BY DESC(?created)
LIMIT 50
```

### 10. Participants in multiple processes

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant ?name (COUNT(DISTINCT ?process) as ?processCount)
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?contribution delib:hasAuthor ?participant ;
                delib:contributesTo ?process .
}
GROUP BY ?participant ?name
HAVING (COUNT(DISTINCT ?process) > 1)
ORDER BY DESC(?processCount)
LIMIT 20
```

## Process Analysis

### 11. Most active deliberation processes

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?process ?title (COUNT(?contribution) as ?contributions)
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title .
  ?contribution delib:contributesTo ?process .
}
GROUP BY ?process ?title
ORDER BY DESC(?contributions)
LIMIT 20
```

### 12. Related deliberation processes (by shared participants)

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process1 ?title1 ?process2 ?title2 (COUNT(?participant) as ?sharedCount)
WHERE {
  ?process1 a delib:DeliberationProcess ;
            dc:title ?title1 .
  ?process2 a delib:DeliberationProcess ;
            dc:title ?title2 .

  ?contribution1 delib:contributesTo ?process1 ;
                 delib:hasAuthor ?participant .
  ?contribution2 delib:contributesTo ?process2 ;
                 delib:hasAuthor ?participant .

  FILTER(?process1 != ?process2)
}
GROUP BY ?process1 ?title1 ?process2 ?title2
HAVING (COUNT(?participant) > 2)
ORDER BY DESC(?sharedCount)
LIMIT 20
```

### 13. Process activity timeline

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?date (COUNT(?contribution) as ?count)
WHERE {
  ?contribution delib:contributesTo <http://yourpriorities.org/kg/group/789> ;
                dcterms:created ?created .
  BIND(SUBSTR(STR(?created), 1, 10) as ?date)
}
GROUP BY ?date
ORDER BY ?date
```

## Fallacy Detection

### 14. All detected fallacies

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?fallacy ?type ?confidence ?argument ?description
WHERE {
  ?fallacy a delib:Fallacy ;
           delib:fallacyType ?type ;
           delib:confidence ?confidence ;
           delib:detectedIn ?argument .
  ?argument dc:description ?description .
}
ORDER BY DESC(?confidence)
LIMIT 50
```

### 15. Fallacy statistics by type

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>

SELECT ?fallacyType (COUNT(?fallacy) as ?count) (AVG(?confidence) as ?avgConfidence)
WHERE {
  ?fallacy a delib:Fallacy ;
           delib:fallacyType ?fallacyType ;
           delib:confidence ?confidence .
}
GROUP BY ?fallacyType
ORDER BY DESC(?count)
```

### 16. Arguments with multiple fallacies

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?argument ?description (COUNT(?fallacy) as ?fallacyCount)
WHERE {
  ?argument a delib:Argument ;
            dc:description ?description ;
            delib:containsFallacy ?fallacy .
}
GROUP BY ?argument ?description
HAVING (COUNT(?fallacy) > 1)
ORDER BY DESC(?fallacyCount)
LIMIT 20
```

### 17. Participants with most fallacious arguments

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant ?name (COUNT(?fallacy) as ?fallacyCount)
WHERE {
  ?participant a delib:Participant ;
               foaf:name ?name .
  ?argument delib:hasAuthor ?participant ;
            delib:containsFallacy ?fallacy .
}
GROUP BY ?participant ?name
ORDER BY DESC(?fallacyCount)
LIMIT 20
```

## Network Analysis

### 18. Argument response chains

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?arg1 ?desc1 ?arg2 ?desc2 ?arg3 ?desc3
WHERE {
  ?arg1 dc:description ?desc1 .
  ?arg2 delib:respondsTo ?arg1 ;
        dc:description ?desc2 .
  ?arg3 delib:respondsTo ?arg2 ;
        dc:description ?desc3 .
}
LIMIT 20
```

### 19. Participant interaction network

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?participant1 ?name1 ?participant2 ?name2 (COUNT(*) as ?interactions)
WHERE {
  ?participant1 foaf:name ?name1 .
  ?participant2 foaf:name ?name2 .

  ?contribution1 delib:hasAuthor ?participant1 .
  ?contribution2 delib:hasAuthor ?participant2 ;
                 delib:respondsTo ?contribution1 .

  FILTER(?participant1 != ?participant2)
}
GROUP BY ?participant1 ?name1 ?participant2 ?name2
ORDER BY DESC(?interactions)
LIMIT 50
```

## Advanced Analytics

### 20. Argument quality by process

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process ?title (AVG(?quality) as ?avgQuality) (COUNT(?argument) as ?argCount)
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title .
  ?argument delib:contributesTo ?process ;
            delib:qualityScore ?quality .
}
GROUP BY ?process ?title
ORDER BY DESC(?avgQuality)
LIMIT 20
```

### 21. Endorsement vs quality correlation

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>

SELECT ?proposal ?endorsements ?quality
WHERE {
  ?proposal a delib:Proposal ;
            delib:endorsementCount ?endorsements .
  OPTIONAL {
    ?argument delib:supports ?proposal ;
              delib:qualityScore ?quality .
  }
}
ORDER BY DESC(?endorsements)
LIMIT 50
```

### 22. Process diversity (unique participants)

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?process ?title (COUNT(DISTINCT ?participant) as ?uniqueParticipants)
WHERE {
  ?process a delib:DeliberationProcess ;
           dc:title ?title .
  ?contribution delib:contributesTo ?process ;
                delib:hasAuthor ?participant .
}
GROUP BY ?process ?title
ORDER BY DESC(?uniqueParticipants)
LIMIT 20
```

## Utility Queries

### 23. Search by keyword in arguments

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT ?argument ?description
WHERE {
  ?argument a delib:Argument ;
            dc:description ?description .
  FILTER(CONTAINS(LCASE(?description), "climate"))
}
LIMIT 50
```

### 24. Recent activity (last 7 days)

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?contribution ?type ?title ?created
WHERE {
  ?contribution a ?type ;
                dc:title ?title ;
                dcterms:created ?created .
  FILTER(?type = delib:Proposal || ?type = delib:Argument)
  FILTER(?created > "2025-01-07T00:00:00Z"^^xsd:dateTime)
}
ORDER BY DESC(?created)
LIMIT 100
```

### 25. Export process to RDF

```sparql
PREFIX delib: <http://www.semanticweb.org/deliberation-ontology#>
PREFIX yp: <http://yourpriorities.org/kg/>

CONSTRUCT {
  ?s ?p ?o .
}
WHERE {
  {
    ?s delib:contributesTo <http://yourpriorities.org/kg/group/789> ;
       ?p ?o .
  }
  UNION
  {
    <http://yourpriorities.org/kg/group/789> ?p ?o .
  }
}
```

## Query Templates

### Template: Get entity by ID

Replace `{TYPE}` and `{ID}`:

```sparql
PREFIX yp: <http://yourpriorities.org/kg/>

SELECT ?property ?value
WHERE {
  <http://yourpriorities.org/kg/{TYPE}/{ID}> ?property ?value .
}
```

### Template: Filter by date range

Replace `{START_DATE}` and `{END_DATE}`:

```sparql
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?entity ?created
WHERE {
  ?entity dcterms:created ?created .
  FILTER(?created >= "{START_DATE}"^^xsd:dateTime &&
         ?created <= "{END_DATE}"^^xsd:dateTime)
}
ORDER BY ?created
```

## Using These Queries

### Via Your Priorities API

```bash
curl -X POST http://localhost:8000/api/knowledge-graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "sparql": "YOUR_SPARQL_QUERY_HERE",
    "format": "json"
  }'
```

### Via Fuseki Directly

```bash
curl -X POST http://localhost:3030/deliberation/query \
  --data-urlencode "query=YOUR_SPARQL_QUERY_HERE"
```

### Via Fuseki UI

1. Go to http://localhost:3030
2. Select "deliberation" dataset
3. Click "Query"
4. Paste your SPARQL query
5. Click "Execute"

## Performance Tips

1. **Always use LIMIT** to avoid huge result sets
2. **Filter early** in your WHERE clause
3. **Use specific predicates** instead of `?p ?o`
4. **Index frequently queried properties**
5. **Cache common queries** on application level

## Next Steps

- Combine multiple queries for complex analysis
- Export results to CSV/JSON for visualization
- Build dashboards using these queries
- Create custom queries for your specific use cases

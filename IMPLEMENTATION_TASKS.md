# Task Implementation Plan - DKG Fallacy Detection Platform

Piano di implementazione strutturato per le feature mancanti, organizzato in Epic e Task atomiche.

---

## EPIC 1: FALLACY DETECTION SYSTEM 🔴

### Phase 1.1: Infrastructure Setup

#### TASK 1.1.1: Setup ML Development Environment
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Dependencies**: None

**Description**: Setup environment per training e deployment di ML models

**Subtasks**:
- [ ] Setup PyTorch/TensorFlow environment
- [ ] Configure GPU support (se disponibile)
- [ ] Setup MLflow per experiment tracking
- [ ] Configure model versioning (DVC o MLflow Model Registry)
- [ ] Setup CI/CD pipeline per ML models

**Acceptance Criteria**:
- [ ] Ambiente Python 3.10+ con dependencies installate
- [ ] Jupyter notebook funzionante per exploratory analysis
- [ ] MLflow tracking server accessibile
- [ ] GPU correttamente configurato (se disponibile)

---

#### TASK 1.1.2: Create Fallacy Taxonomy & Schema
**Priority**: P0 (Blocker)
**Estimate**: 3 days
**Dependencies**: None

**Description**: Definire tassonomia completa delle fallacie da rilevare

**Subtasks**:
- [ ] Ricerca letteratura su fallacy taxonomies (Aristotle, Walton, Jin et al.)
- [ ] Definire 13+ fallacy types con esempi in IT/EN
- [ ] Creare JSON schema per fallacy metadata
- [ ] Documentare ogni fallacy con:
  - Definizione formale
  - 5+ esempi in italiano
  - 5+ esempi in inglese
  - Varianti e casi edge
  - Differenze con fallacie simili
- [ ] Review con esperti di logica/filosofia

**Deliverables**:
- `docs/fallacy_taxonomy.md` con documentazione completa
- `schemas/fallacy_schema.json` con struttura dati
- `data/fallacy_examples.json` con esempi annotati

**Acceptance Criteria**:
- [ ] Almeno 13 fallacy types definiti
- [ ] Ogni tipo ha ≥5 esempi in IT e EN
- [ ] Schema validato con JSON Schema validator
- [ ] Reviewed da almeno 2 persone

---

#### TASK 1.1.3: Build Fallacy Training Dataset
**Priority**: P0 (Blocker)
**Estimate**: 10 days
**Dependencies**: TASK 1.1.2

**Description**: Creare dataset annotato per training fallacy detection model

**Subtasks**:
- [ ] Collect argomenti da Your Priorities esistenti
- [ ] Scrape discussions da forum pubblici (Reddit, Twitter, ecc.)
- [ ] Raccogliere debates da fonti accademiche
- [ ] Setup annotation tool (Label Studio, Prodigy, o custom)
- [ ] Reclutare 3-5 annotatori
- [ ] Training session per annotatori (inter-annotator agreement)
- [ ] Annotare 5000+ arguments con fallacies
- [ ] Calcolare Cohen's Kappa (inter-annotator agreement)
- [ ] Resolve conflicts tramite majority voting o expert review
- [ ] Split dataset: train (70%), validation (15%), test (15%)

**Deliverables**:
- `data/fallacy_dataset_train.jsonl`
- `data/fallacy_dataset_val.jsonl`
- `data/fallacy_dataset_test.jsonl`
- `docs/annotation_guidelines.md`
- `docs/dataset_statistics.md`

**Acceptance Criteria**:
- [ ] ≥5000 examples annotati
- [ ] Cohen's Kappa ≥0.7 (substantial agreement)
- [ ] Balanced distribution delle fallacy classes
- [ ] ≥1000 examples "no fallacy" (negative class)
- [ ] Dataset in formato standard (JSONL con text, label, metadata)

---

### Phase 1.2: Model Development

#### TASK 1.2.1: Develop Fallacy Detection ML Model
**Priority**: P0 (Blocker)
**Estimate**: 15 days
**Dependencies**: TASK 1.1.3

**Description**: Training del modello di classificazione per fallacy detection

**Subtasks**:
- [ ] Baseline model: Multilingual BERT fine-tuning
- [ ] Experiment 1: RoBERTa-base-it fine-tuning
- [ ] Experiment 2: XLM-RoBERTa per multilingual
- [ ] Experiment 3: DeBERTa v3 per better performance
- [ ] Experiment 4: Ensemble di modelli
- [ ] Hyperparameter tuning (learning rate, batch size, epochs)
- [ ] Implement class weighting per imbalanced classes
- [ ] Add confidence calibration (temperature scaling)
- [ ] Evaluate su test set con metrics:
  - Accuracy, Precision, Recall, F1-score (per class e macro)
  - Confusion matrix
  - ROC-AUC
- [ ] Error analysis: quali fallacie sono più difficili?
- [ ] Document training procedure e results

**Deliverables**:
- `models/fallacy_detector_v1.pt` (model checkpoint)
- `models/fallacy_detector_config.json`
- `notebooks/fallacy_detection_training.ipynb`
- `reports/model_evaluation.md`

**Acceptance Criteria**:
- [ ] F1-score ≥0.75 su test set (macro-average)
- [ ] Precision ≥0.70 per ogni fallacy class
- [ ] Model serializzato e caricabile
- [ ] Inference time <500ms per argument (batch size 1)

---

#### TASK 1.2.2: Build Fallacy Detection API Service
**Priority**: P0 (Blocker)
**Estimate**: 5 days
**Dependencies**: TASK 1.2.1

**Description**: REST API per servire il fallacy detection model

**Subtasks**:
- [ ] Create FastAPI application
- [ ] Implement `/detect_fallacies` endpoint (POST)
- [ ] Load model con lazy loading
- [ ] Implement batching per throughput
- [ ] Add caching layer (Redis) per repeated texts
- [ ] Add rate limiting
- [ ] Implement health check endpoint
- [ ] Add Prometheus metrics
- [ ] Docker container per deployment
- [ ] Write API documentation (OpenAPI/Swagger)

**API Spec**:
```json
POST /api/v1/detect_fallacies
Request:
{
  "text": "Tutti sanno che questa è la verità, quindi deve essere vero.",
  "language": "it"
}

Response:
{
  "fallacies": [
    {
      "type": "ad_populum",
      "text_span": "Tutti sanno che questa è la verità",
      "start_char": 0,
      "end_char": 38,
      "confidence": 0.87,
      "explanation": "Questo argomento fa appello alla popolarità invece che a evidenze concrete..."
    }
  ],
  "overall_quality_score": 0.45
}
```

**Deliverables**:
- `server_api/src/services/fallacy_detection/` (service code)
- `Dockerfile.fallacy_service`
- `docs/fallacy_api.md`

**Acceptance Criteria**:
- [ ] API risponde correttamente a richieste valide
- [ ] Error handling per input malformati
- [ ] Latenza p95 <1 secondo
- [ ] Throughput ≥50 requests/second (con batching)
- [ ] Tests unitari e integration tests
- [ ] API docs accessibili via Swagger UI

---

### Phase 1.3: Integration with Your Priorities

#### TASK 1.3.1: Integrate Fallacy Detection in Comment Flow
**Priority**: P0 (Blocker)
**Estimate**: 5 days
**Dependencies**: TASK 1.2.2

**Description**: Integrare fallacy detection nel flusso di creazione/editing commenti

**Subtasks**:
- [ ] Add `fallacies` field to Point model (JSONB array)
- [ ] Create migration per aggiungere campo
- [ ] Implement service call da `PointsController`
- [ ] Add async processing (queue con BullMQ)
- [ ] Store fallacy detections in database
- [ ] Add fallacy_detection_status field (pending, completed, failed)
- [ ] Implement retry logic per failed detections
- [ ] Add admin toggle per enable/disable detection
- [ ] Add user preference per opt-in/opt-out

**Database Schema**:
```typescript
interface Point {
  // existing fields...
  fallacies?: Fallacy[];
  fallacy_detection_status?: 'pending' | 'completed' | 'failed';
  fallacy_detection_requested_at?: Date;
  fallacy_detection_completed_at?: Date;
}

interface Fallacy {
  type: string;
  text_span: string;
  start_char: number;
  end_char: number;
  confidence: number;
  explanation: string;
  created_at: Date;
  validated?: boolean; // community validation
  validation_score?: number; // aggregated from user feedback
}
```

**Deliverables**:
- Migration file
- Updated Point model
- Service integration code
- Queue worker code

**Acceptance Criteria**:
- [ ] Fallacy detection triggera automaticamente su new points
- [ ] Processing è asincrono (non blocca user)
- [ ] Fallacies salvate correttamente in DB
- [ ] Admin può enable/disable globally
- [ ] Users possono opt-out

---

#### TASK 1.3.2: Build Fallacy Feedback UI Component
**Priority**: P0 (Blocker)
**Estimate**: 5 days
**Dependencies**: TASK 1.3.1

**Description**: UI component per mostrare fallacy detection feedback

**Subtasks**:
- [ ] Create `yp-fallacy-indicator.ts` web component
- [ ] Design UI mockup (Figma o sketch)
- [ ] Implement fallacy badge/indicator
- [ ] Implement expandable explanation panel
- [ ] Add "Was this helpful?" feedback buttons
- [ ] Implement educational modal con esempi
- [ ] Add animation per non-invasive display
- [ ] Responsive design (mobile + desktop)
- [ ] Accessibility: ARIA labels, keyboard navigation
- [ ] I18n support (IT/EN/ES/FR/DE)

**UI Features**:
- Subtle indicator accanto al testo (non invadente)
- Click per espandere spiegazione
- Link a risorse educative
- Opzione "Contest this detection"
- Progress bar per confidence score

**Deliverables**:
- `webApps/client/src/yp-fallacy/yp-fallacy-indicator.ts`
- `webApps/client/src/yp-fallacy/yp-fallacy-explanation.ts`
- CSS styles
- Translation files

**Acceptance Criteria**:
- [ ] Component renderizza correttamente su tutti i browsers
- [ ] Accessibile via screen reader
- [ ] Non impatta performance della page
- [ ] Traduzioni complete per 5+ lingue
- [ ] User testing positivo (≥80% trovano utile)

---

#### TASK 1.3.3: Implement Educational Feedback System
**Priority**: P1 (High)
**Estimate**: 5 days
**Dependencies**: TASK 1.3.2

**Description**: Sistema completo di feedback educativo per ogni fallacy

**Subtasks**:
- [ ] Create fallacy explanation templates
- [ ] Add "Why is this a fallacy?" section
- [ ] Add "How to improve" suggestions
- [ ] Add "Learn more" links (Wikipedia, Stanford Encyclopedia)
- [ ] Implement interactive examples
- [ ] Add quiz/self-test per ogni fallacy type
- [ ] Track user learning progress
- [ ] Badge/achievement system per learning milestones
- [ ] Create "Fallacy Academy" section

**Content per ogni Fallacy**:
1. **Name & Definition**
2. **Why it's problematic**
3. **Examples** (good vs bad arguments)
4. **How to avoid it**
5. **Related fallacies**
6. **Further reading**

**Deliverables**:
- `docs/fallacy_education_content/` (content per ogni fallacy)
- `yp-fallacy-academy.ts` component
- Learning progress tracking system

**Acceptance Criteria**:
- [ ] Content chiaro e comprensibile (livello high school)
- [ ] Esempi rilevanti e culturalmente appropriati
- [ ] Linked a risorse esterne autorevoli
- [ ] User engagement metrics: ≥50% click su "Learn more"
- [ ] Completion rate quiz ≥40%

---

### Phase 1.4: Community Validation

#### TASK 1.4.1: Build Fallacy Validation System
**Priority**: P1 (High)
**Estimate**: 5 days
**Dependencies**: TASK 1.3.2

**Description**: Sistema per permettere alla community di validare fallacy detections

**Subtasks**:
- [ ] Add "Was this detection accurate?" UI
- [ ] Implement thumbs up/down voting
- [ ] Add "Report false positive" flow
- [ ] Add "Report missed fallacy" flow
- [ ] Create validation dashboard per moderators
- [ ] Aggregate validation scores
- [ ] Threshold per hide low-confidence detections
- [ ] Notification to model team per frequent false positives
- [ ] Integration con reputation system esistente

**Voting Options**:
- ✅ Correct detection
- ❌ False positive (not a fallacy)
- ⚠️ Wrong fallacy type (correct type: ...)
- 📝 Needs more context

**Deliverables**:
- Validation UI components
- Validation database schema
- Aggregation logic
- Moderator dashboard

**Acceptance Criteria**:
- [ ] Users possono facilmente votare
- [ ] Votes aggregati correttamente
- [ ] Moderators hanno visibilità su disputed detections
- [ ] False positive rate scende ≥30% dopo 3 mesi

---

#### TASK 1.4.2: Implement Reinforcement Learning from Feedback
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: TASK 1.4.1

**Description**: Sistema di RLHF per migliorare il modello da user feedback

**Subtasks**:
- [ ] Collect validation feedback in structured format
- [ ] Setup reward model (correct detection = +1, false positive = -1)
- [ ] Implement active learning pipeline
- [ ] Retrain model mensile con feedback data
- [ ] A/B testing framework per compare model versions
- [ ] Metrics dashboard per model performance over time
- [ ] Automated model deployment se metrics improve

**Deliverables**:
- RLHF pipeline code
- Automated retraining scripts
- A/B testing framework
- Metrics dashboard

**Acceptance Criteria**:
- [ ] Pipeline esegue automaticamente ogni mese
- [ ] Metrics migliorano ≥5% dopo 6 mesi
- [ ] A/B tests statisticamente significativi (p<0.05)

---

## EPIC 2: DELIBERATION KNOWLEDGE GRAPH 🔴

### Phase 2.1: Ontology Development

#### TASK 2.1.1: Design Deliberation Ontology (OWL)
**Priority**: P0 (Blocker)
**Estimate**: 10 days
**Dependencies**: None

**Description**: Progettare ontologia formale per rappresentare deliberazioni

**Subtasks**:
- [ ] Study existing ontologies (Deliberation Ontology, SIOC, FOAF)
- [ ] Define competency questions (cosa vogliamo rappresentare?)
- [ ] Design class hierarchy:
  - **Process Model**: DeliberationProcess, Stage, Timeline
  - **Participant Model**: Person, Organization, Role, Stakeholder
  - **Contribution Model**: Argument, Claim, Premise, Warrant, Evidence
  - **Fallacy Model**: Fallacy, FallacyType, Validation
  - **Decision Model**: Vote, Consensus, Decision, Majority/Minority
- [ ] Define object properties (relationships)
- [ ] Define data properties (attributes)
- [ ] Define cardinality constraints
- [ ] Create ontology in Protégé
- [ ] Validate with reasoning (HermiT, Pellet)
- [ ] Generate documentation (LODE)
- [ ] Peer review con ontology experts

**Key Classes**:
```turtle
@prefix dkg: <http://yourpriorities.org/ontology#> .

dkg:DeliberationProcess a owl:Class .
dkg:Argument a owl:Class .
dkg:Claim a owl:Class .
dkg:Premise a owl:Class .
dkg:Fallacy a owl:Class .
dkg:Vote a owl:Class .

dkg:hasArgument a owl:ObjectProperty ;
    rdfs:domain dkg:DeliberationProcess ;
    rdfs:range dkg:Argument .

dkg:hasClaim a owl:ObjectProperty ;
    rdfs:domain dkg:Argument ;
    rdfs:range dkg:Claim .

dkg:supportedBy a owl:ObjectProperty ;
    rdfs:domain dkg:Claim ;
    rdfs:range dkg:Premise .

dkg:containsFallacy a owl:ObjectProperty ;
    rdfs:domain dkg:Argument ;
    rdfs:range dkg:Fallacy .
```

**Deliverables**:
- `ontology/deliberation_ontology.owl`
- `ontology/deliberation_ontology.ttl`
- `docs/ontology_documentation.html`
- `docs/competency_questions.md`

**Acceptance Criteria**:
- [ ] Ontology passa consistency check in Protégé
- [ ] ≥50 classes defined
- [ ] ≥100 properties defined
- [ ] Documented con esempi
- [ ] Peer reviewed

---

#### TASK 2.1.2: Setup Graph Database (Neo4j)
**Priority**: P0 (Blocker)
**Estimate**: 3 days
**Dependencies**: None

**Description**: Setup Neo4j per property graph representation

**Subtasks**:
- [ ] Install Neo4j Enterprise o Community Edition
- [ ] Configure cluster (se prod) o single instance (dev)
- [ ] Setup authentication e RBAC
- [ ] Configure backup strategy
- [ ] Install APOC plugin
- [ ] Install Graph Data Science library
- [ ] Setup monitoring (Prometheus + Grafana)
- [ ] Create indexes per performance
- [ ] Write connection service in Node.js/TypeScript

**Deliverables**:
- Neo4j instance running
- Connection library code
- Docker Compose config
- Backup scripts

**Acceptance Criteria**:
- [ ] Neo4j accessibile via Bolt protocol
- [ ] Monitoring dashboard funzionante
- [ ] Connection library con tests
- [ ] Backup automatico giornaliero

---

#### TASK 2.1.3: Setup RDF Triple Store (Blazegraph/Virtuoso)
**Priority**: P0 (Blocker)
**Estimate**: 3 days
**Dependencies**: TASK 2.1.1

**Description**: Setup triple store per semantic queries

**Subtasks**:
- [ ] Choose triple store (Blazegraph vs Virtuoso vs GraphDB)
- [ ] Install e configure
- [ ] Load deliberation ontology
- [ ] Setup SPARQL endpoint
- [ ] Configure inference (RDFS/OWL reasoning)
- [ ] Setup authentication
- [ ] Create backup strategy
- [ ] Write SPARQL query library
- [ ] Setup monitoring

**Deliverables**:
- Triple store instance
- SPARQL endpoint
- Query library
- Docker config

**Acceptance Criteria**:
- [ ] SPARQL endpoint accessibile
- [ ] Ontology loaded correttamente
- [ ] Inference funzionante
- [ ] Query performance accettabile (<1s per simple queries)

---

### Phase 2.2: Data Migration & Population

#### TASK 2.2.1: Migrate Existing Data to Knowledge Graph
**Priority**: P1 (High)
**Estimate**: 10 days
**Dependencies**: TASK 2.1.2, TASK 2.1.3

**Description**: ETL pipeline per migrare dati esistenti nel knowledge graph

**Subtasks**:
- [ ] Analyze current PostgreSQL schema
- [ ] Design mapping da relational → graph
- [ ] Write ETL scripts (Node.js/Python)
- [ ] Migrate users → Person nodes
- [ ] Migrate groups → Organization nodes
- [ ] Migrate posts → DeliberationProcess nodes
- [ ] Migrate points → Argument nodes
- [ ] Extract claim/premise structure da text
- [ ] Create relationships
- [ ] Validate data integrity
- [ ] Create RDF representation
- [ ] Load into triple store

**Mapping Examples**:
```javascript
// PostgreSQL → Neo4j
Post → (:DeliberationProcess {id, name, description, created_at})
Point → (:Argument {id, content, value, created_at})
User → (:Person {id, name, email})

// Relationships
(User)-[:AUTHORED]->(Argument)
(Argument)-[:SUPPORTS|OPPOSES]->(DeliberationProcess)
(Argument)-[:RESPONDS_TO]->(Argument)
```

**Deliverables**:
- ETL scripts
- Data validation reports
- Migration documentation

**Acceptance Criteria**:
- [ ] 100% dei dati critici migrati
- [ ] No data loss (checksums verificati)
- [ ] Relationships corrette
- [ ] Performance accettabile (<1 hour per full migration)

---

#### TASK 2.2.2: Implement Argument Structure Extraction
**Priority**: P1 (High)
**Estimate**: 10 days
**Dependencies**: TASK 2.2.1

**Description**: NLP pipeline per estrarre struttura argomenti (claim, premise, warrant)

**Subtasks**:
- [ ] Research argument mining techniques
- [ ] Choose approach: rule-based vs ML
- [ ] If ML: collect training data (ArgMining datasets)
- [ ] Implement claim extraction
- [ ] Implement premise extraction
- [ ] Implement warrant/backing extraction
- [ ] Detect argument schemes (Walton)
- [ ] Create relationships claim-premise
- [ ] Store in knowledge graph
- [ ] Validate accuracy (precision/recall)

**Approach**:
- Use pre-trained models (ArgKP, UKP ArgMining)
- Fine-tune on Your Priorities data
- Combine with rule-based heuristics

**Deliverables**:
- Argument mining pipeline
- Trained models (if applicable)
- Evaluation report

**Acceptance Criteria**:
- [ ] Precision ≥0.65 per claim extraction
- [ ] Precision ≥0.60 per premise extraction
- [ ] Pipeline processa ≥100 arguments/minute

---

#### TASK 2.2.3: Integrate External Data Sources
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: TASK 2.1.3

**Description**: Importare dati da fonti esterne (parlamenti, piattaforme civiche)

**Subtasks**:
- [ ] Identify target data sources:
  - EU Parliament proceedings (EuroParl API)
  - Italian Parliament (Camera/Senato open data)
  - Decidim instances (via API)
  - Academic papers (Semantic Scholar API)
- [ ] Write scrapers/API clients
- [ ] Transform to RDF
- [ ] Entity linking (match entities cross-platform)
- [ ] Load into knowledge graph
- [ ] Setup scheduled updates (cron jobs)

**Deliverables**:
- Scraper/API client code
- Transformation scripts
- Scheduled jobs

**Acceptance Criteria**:
- [ ] ≥3 external sources integrated
- [ ] Updates automatici settimanali
- [ ] Entity linking accuracy ≥70%

---

### Phase 2.3: Knowledge Graph Features

#### TASK 2.3.1: Implement SPARQL Query Interface
**Priority**: P1 (High)
**Estimate**: 5 days
**Dependencies**: TASK 2.1.3

**Description**: API per eseguire SPARQL queries sul knowledge graph

**Subtasks**:
- [ ] Create `/api/v1/sparql` endpoint
- [ ] Implement query validation (prevent injection)
- [ ] Add query templates per common use cases
- [ ] Implement result caching
- [ ] Add pagination per large results
- [ ] Rate limiting
- [ ] Query complexity limits (prevent DoS)
- [ ] Web UI per query editor (YASGUI)

**Example Queries**:
```sparql
# Find all arguments supporting a position
SELECT ?arg ?author ?text WHERE {
  ?arg dkg:supports ?position .
  ?arg dkg:hasAuthor ?author .
  ?arg dkg:hasText ?text .
}

# Find contradicting arguments
SELECT ?arg1 ?arg2 WHERE {
  ?arg1 dkg:contradicts ?arg2 .
}
```

**Deliverables**:
- SPARQL endpoint
- Query templates
- Web UI

**Acceptance Criteria**:
- [ ] Endpoint funzionante
- [ ] ≥20 query templates
- [ ] Query editor user-friendly
- [ ] Performance: p95 <2s

---

#### TASK 2.3.2: Build Knowledge Graph Explorer UI
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: TASK 2.2.1

**Description**: Interactive UI per esplorare il knowledge graph

**Subtasks**:
- [ ] Choose visualization library (Cytoscape.js, vis.js, D3.js)
- [ ] Create `yp-knowledge-graph-explorer.ts` component
- [ ] Implement node/edge rendering
- [ ] Add zoom/pan controls
- [ ] Implement click → expand neighbors
- [ ] Add filtering (by node type, date, topic)
- [ ] Add search functionality
- [ ] Implement graph layouts (force-directed, hierarchical)
- [ ] Add timeline slider per temporal evolution
- [ ] Export graph (PNG, SVG, GraphML)

**Features**:
- Interactive graph visualization
- Node details panel
- Path finding between arguments
- Community detection visualization
- Temporal evolution animation

**Deliverables**:
- Graph explorer component
- Visualization configurations
- User guide

**Acceptance Criteria**:
- [ ] Visualizza ≥1000 nodes senza lag
- [ ] Interactive e responsive
- [ ] Works su mobile (touch gestures)
- [ ] User testing positivo

---

#### TASK 2.3.3: Implement Semantic Search
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 2.2.1

**Description**: Search semantica sul knowledge graph usando embeddings

**Subtasks**:
- [ ] Generate embeddings per arguments (Sentence-BERT)
- [ ] Store embeddings in vector DB (Milvus, Weaviate, o Pinecone)
- [ ] Create search endpoint
- [ ] Implement semantic similarity search
- [ ] Combine with keyword search (hybrid)
- [ ] Add faceted filtering
- [ ] Implement "Similar arguments" feature
- [ ] Add "Find related discussions"

**Tech Stack**:
- Sentence-BERT (all-MiniLM-L6-v2 or multilingual)
- Vector DB (Weaviate recommended)
- Hybrid search (BM25 + semantic)

**Deliverables**:
- Embedding generation pipeline
- Vector DB setup
- Search API
- Search UI component

**Acceptance Criteria**:
- [ ] Search latency <300ms
- [ ] Relevant results (nDCG ≥0.7)
- [ ] Multilingual support (IT/EN)

---

## EPIC 3: ADVANCED ARGUMENT ANALYSIS 🔴

### Phase 3.1: Argument Mining

#### TASK 3.1.1: Implement Claim Extraction
**Priority**: P1 (High)
**Estimate**: 7 days
**Dependencies**: None

**Description**: Automatic extraction di claims principali da arguments

**Subtasks**:
- [ ] Research state-of-the-art (ArgKP, UKP)
- [ ] Fine-tune BERT per claim detection
- [ ] Implement claim boundary detection
- [ ] Handle multi-claim arguments
- [ ] Validate on test set
- [ ] Integrate in pipeline

**Deliverables**:
- Claim extraction model
- Integration code

**Acceptance Criteria**:
- [ ] F1 ≥0.70 per claim detection

---

#### TASK 3.1.2: Implement Premise-Claim Linking
**Priority**: P1 (High)
**Estimate**: 7 days
**Dependencies**: TASK 3.1.1

**Description**: Link premises a claims che supportano

**Subtasks**:
- [ ] Collect annotated data
- [ ] Train linking model
- [ ] Detect support/attack relationships
- [ ] Store in knowledge graph

**Deliverables**:
- Linking model
- Integration code

**Acceptance Criteria**:
- [ ] Accuracy ≥0.65 per linking

---

#### TASK 3.1.3: Implement Contradiction Detection
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 3.1.2

**Description**: Rilevare argomenti contraddittori

**Subtasks**:
- [ ] Use NLI models (Natural Language Inference)
- [ ] Fine-tune su domain data
- [ ] Detect entailment/contradiction
- [ ] Highlight contradictions in UI

**Deliverables**:
- Contradiction detection service
- UI component

**Acceptance Criteria**:
- [ ] Accuracy ≥0.70

---

### Phase 3.2: Argument Enhancement

#### TASK 3.2.1: Build Argument Construction Wizard
**Priority**: P1 (High)
**Estimate**: 7 days
**Dependencies**: None

**Description**: AI-assisted wizard per scrivere argomenti di qualità

**Subtasks**:
- [ ] Design wizard flow (multi-step)
- [ ] Step 1: Choose position (support/oppose)
- [ ] Step 2: State your claim
- [ ] Step 3: Provide evidence
- [ ] Step 4: Address counterarguments
- [ ] Step 5: Review & submit
- [ ] Real-time AI suggestions ad ogni step
- [ ] Template arguments per inspiration
- [ ] Integrate fallacy detection (real-time)

**Deliverables**:
- Wizard UI component
- AI suggestion service

**Acceptance Criteria**:
- [ ] Completion rate ≥60%
- [ ] Arguments created via wizard have higher quality scores

---

#### TASK 3.2.2: Implement Evidence Suggestion System
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 2.3.3

**Description**: Suggerire evidenze rilevanti da knowledge graph

**Subtasks**:
- [ ] Semantic search su evidence database
- [ ] Rank by relevance
- [ ] Show preview + source
- [ ] One-click insert

**Deliverables**:
- Evidence suggestion API
- UI component

**Acceptance Criteria**:
- [ ] Suggestions relevant ≥70% of times

---

#### TASK 3.2.3: Implement Counterargument Suggestions
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 2.3.3

**Description**: Suggerire counterarguments basati su knowledge graph

**Subtasks**:
- [ ] Find opposing arguments
- [ ] Rank by strength
- [ ] Present as "Addressing counterarguments"
- [ ] Help user formulate rebuttals

**Deliverables**:
- Counterargument service
- UI integration

**Acceptance Criteria**:
- [ ] Suggestions used ≥30% of times

---

## EPIC 4: MULTI-PERSONA AI FACILITATORS 🟡

#### TASK 4.1.1: Develop AI Persona Framework
**Priority**: P2 (Medium)
**Estimate**: 5 days
**Dependencies**: None

**Description**: Framework per gestire multiple AI personas

**Subtasks**:
- [ ] Design persona schema (personality, tone, goals)
- [ ] Implement persona prompting system
- [ ] Create base personas:
  - Devil's Advocate
  - Mediator
  - Fact-Checker
  - Socratic Questioner
  - Synthesizer
- [ ] Implement persona selection logic
- [ ] Add persona context management

**Deliverables**:
- Persona framework code
- 5 base personas

**Acceptance Criteria**:
- [ ] Personas distinguibili (blind test)
- [ ] Context maintained across conversation

---

#### TASK 4.1.2: Integrate Personas in Discussion Flow
**Priority**: P2 (Medium)
**Estimate**: 5 days
**Dependencies**: TASK 4.1.1

**Description**: AI personas intervengono automaticamente nelle discussioni

**Subtasks**:
- [ ] Trigger logic (quando interviene ogni persona)
- [ ] Generate interventions
- [ ] Display as special comments
- [ ] User feedback ("Was this helpful?")

**Deliverables**:
- Integration code
- UI components

**Acceptance Criteria**:
- [ ] Interventions relevant ≥70% of times
- [ ] User satisfaction ≥60%

---

## EPIC 5: CONSENSUS & DELIBERATION ANALYSIS 🟡

#### TASK 5.1.1: Implement Perspectivized Stance Vectors (PSVs)
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: TASK 2.2.1

**Description**: Multi-dimensional stance representation

**Subtasks**:
- [ ] Research PSV approach (Plenz et al.)
- [ ] Identify relevant dimensions (es. economy, environment, rights)
- [ ] Extract stance vectors da arguments
- [ ] Store in knowledge graph
- [ ] Compute agreement/disagreement scores
- [ ] Find orthogonal perspectives

**Deliverables**:
- PSV extraction code
- Visualization component

**Acceptance Criteria**:
- [ ] Stance vectors accurati
- [ ] Visualizations comprensibili

---

#### TASK 5.1.2: Implement Contextualized Commonsense Knowledge Graphs (CCKGs)
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: TASK 2.1.3

**Description**: Arricchire argomenti con background knowledge

**Subtasks**:
- [ ] Integrate ConceptNet o ATOMIC
- [ ] Extract relevant knowledge per argument
- [ ] Display implicit connections
- [ ] Use for argument enhancement

**Deliverables**:
- CCKG integration
- UI component

**Acceptance Criteria**:
- [ ] Relevant knowledge retrieved ≥70%
- [ ] Improves argument understanding (user survey)

---

#### TASK 5.1.3: Build Consensus Visualization Dashboard
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 5.1.1

**Description**: Dashboard per visualizzare consenso/dissenso

**Subtasks**:
- [ ] Heatmap di agreement/disagreement
- [ ] Stakeholder position map
- [ ] Consensus over time chart
- [ ] Majority/minority positions
- [ ] Export reports

**Deliverables**:
- Dashboard component
- Report generation

**Acceptance Criteria**:
- [ ] Dashboard comprensibile
- [ ] Useful per facilitators (user testing)

---

## EPIC 6: DEMOCRATIC PROCESS LAYER 🟡

#### TASK 6.1.1: Implement Advanced Voting Mechanisms
**Priority**: P2 (Medium)
**Estimate**: 10 days
**Dependencies**: None

**Description**: Aggiungere meccaniche di voto avanzate

**Subtasks**:
- [ ] Qualified majority voting (soglie configurabili)
- [ ] Consensus-based voting
- [ ] Quadratic voting
- [ ] Liquid democracy (delegation)
- [ ] Configurable per deliberation process

**Deliverables**:
- Voting mechanism implementations
- Configuration UI

**Acceptance Criteria**:
- [ ] ≥4 nuovi meccanismi implementati
- [ ] Configurable da admin

---

#### TASK 6.1.2: Build Majority/Minority Position Tracking
**Priority**: P2 (Medium)
**Estimate**: 5 days
**Dependencies**: TASK 6.1.1

**Description**: Track e visualizza posizioni maggioranza/minoranza

**Subtasks**:
- [ ] Calculate majority/minority positions
- [ ] Visualize in UI
- [ ] Highlight minority concerns
- [ ] Generate reports

**Deliverables**:
- Position tracking code
- Visualization

**Acceptance Criteria**:
- [ ] Positions accurate
- [ ] Minority concerns visible

---

#### TASK 6.1.3: Implement Delegation Mechanisms
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 6.1.1

**Description**: Liquid democracy con delegation

**Subtasks**:
- [ ] User can delegate vote to expert
- [ ] Transitive delegation
- [ ] Revoke delegation
- [ ] Delegation graph visualization

**Deliverables**:
- Delegation system
- UI components

**Acceptance Criteria**:
- [ ] Delegation works correctly
- [ ] No cycles
- [ ] Visualization chiara

---

## EPIC 7: ANALYTICS & EVALUATION 🟡

#### TASK 7.1.1: Implement Deliberative Quality Metrics
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 2.2.1

**Description**: Metriche per valutare qualità deliberativa

**Subtasks**:
- [ ] Implement Discourse Quality Index (DQI)
- [ ] Inclusivity metrics
- [ ] Reason-giving quality
- [ ] Reflection indicators
- [ ] Reciprocity metrics
- [ ] Dashboard con trends

**Deliverables**:
- Metrics calculation code
- Dashboard

**Acceptance Criteria**:
- [ ] Metrics implementate correttamente
- [ ] Dashboard informativo

---

#### TASK 7.1.2: Build Advanced Analytics Dashboard
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 7.1.1

**Description**: Dashboard completo per analytics

**Subtasks**:
- [ ] Real-time deliberation metrics
- [ ] Participation analytics
- [ ] Argument quality trends
- [ ] Consensus progress tracking
- [ ] Influence network analysis
- [ ] Topic emergence detection
- [ ] Export reports (PDF, Excel)

**Deliverables**:
- Analytics dashboard
- Report templates

**Acceptance Criteria**:
- [ ] Dashboard comprensibile e informativo
- [ ] Real-time updates
- [ ] Export funzionante

---

## EPIC 8: USABILITY ENHANCEMENTS 🟢

#### TASK 8.1.1: Implement Inline Image Embedding
**Priority**: P3 (Low)
**Estimate**: 3 days
**Dependencies**: None

**Description**: Supporto per immagini inline nel testo

**Subtasks**:
- [ ] Rich text editor upgrade (TinyMCE o Quill)
- [ ] Drag & drop upload
- [ ] Image resizing
- [ ] Alt text per accessibility

**Deliverables**:
- Rich text editor component

**Acceptance Criteria**:
- [ ] Immagini inline funzionanti
- [ ] Accessible

---

#### TASK 8.1.2: Implement Collaborative Argument Drafting
**Priority**: P3 (Low)
**Estimate**: 10 days
**Dependencies**: None

**Description**: Real-time co-editing di argomenti

**Subtasks**:
- [ ] Choose collaboration framework (Yjs, ShareDB)
- [ ] Implement CRDT-based editing
- [ ] Show active collaborators
- [ ] Cursor/selection visibility
- [ ] Comment threads

**Deliverables**:
- Collaborative editor

**Acceptance Criteria**:
- [ ] Real-time sync funzionante
- [ ] No conflicts

---

## EPIC 9: INTEGRATION & INTEROPERABILITY 🟢

#### TASK 9.1.1: Implement ActivityPub Support
**Priority**: P3 (Low)
**Estimate**: 10 days
**Dependencies**: None

**Description**: Fediverse integration

**Subtasks**:
- [ ] Implement ActivityPub protocol
- [ ] Create Actor endpoints
- [ ] Federate posts/comments
- [ ] Follow/unfollow cross-instance

**Deliverables**:
- ActivityPub implementation

**Acceptance Criteria**:
- [ ] Can federate con Mastodon
- [ ] Protocol compliance

---

#### TASK 9.1.2: Build Decidim Integration
**Priority**: P3 (Low)
**Estimate**: 7 days
**Dependencies**: TASK 2.1.3

**Description**: Import deliberazioni da Decidim

**Subtasks**:
- [ ] API client per Decidim
- [ ] Data transformation
- [ ] Import to knowledge graph

**Deliverables**:
- Decidim integration

**Acceptance Criteria**:
- [ ] Import funzionante
- [ ] Data integrity

---

## EPIC 10: ETHICAL & PRIVACY 🟡

#### TASK 10.1.1: Build Algorithm Transparency Dashboard
**Priority**: P2 (Medium)
**Estimate**: 5 days
**Dependencies**: None

**Description**: Dashboard per spiegare decisioni algoritmiche

**Subtasks**:
- [ ] Explain fallacy detection logic
- [ ] Show model confidence
- [ ] Provide model cards
- [ ] Audit logs accessibili

**Deliverables**:
- Transparency dashboard

**Acceptance Criteria**:
- [ ] Users capiscono come funzionano gli algoritmi
- [ ] Audit logs completi

---

#### TASK 10.1.2: Implement Explainable AI (XAI)
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 1.2.1

**Description**: XAI per tutte le AI decisions

**Subtasks**:
- [ ] SHAP/LIME integration per fallacy detection
- [ ] Attention visualization per transformer models
- [ ] Feature importance display

**Deliverables**:
- XAI integration

**Acceptance Criteria**:
- [ ] Explanations comprensibili
- [ ] Trust aumenta (user survey)

---

#### TASK 10.1.3: Implement Bias Detection & Mitigation
**Priority**: P2 (Medium)
**Estimate**: 7 days
**Dependencies**: TASK 1.2.1

**Description**: Rilevare e mitigare bias nei modelli

**Subtasks**:
- [ ] Fairness metrics (demographic parity, equalized odds)
- [ ] Test su diverse demographics
- [ ] Bias mitigation techniques
- [ ] Continuous monitoring

**Deliverables**:
- Bias detection system
- Mitigation strategies

**Acceptance Criteria**:
- [ ] Fairness metrics > threshold
- [ ] No significant bias detected

---

## SUMMARY BY PRIORITY

### 🔴 P0 (Blocker) - Must Have for MVP (6-8 months)
- Complete Fallacy Detection System (EPIC 1, Phases 1.1-1.3)
- Basic Knowledge Graph (EPIC 2, Phase 2.1-2.2)
- Argument Mining (EPIC 3, Phase 3.1)

### 🟡 P1 (High) - Important for Full Release (3-4 months after MVP)
- Community Validation (EPIC 1, Phase 1.4)
- Knowledge Graph Features (EPIC 2, Phase 2.3)
- Argument Enhancement (EPIC 3, Phase 3.2)

### 🟡 P2 (Medium) - Nice to Have (6-12 months after MVP)
- AI Facilitators (EPIC 4)
- Consensus Analysis (EPIC 5)
- Democratic Process Layer (EPIC 6)
- Analytics (EPIC 7)
- Ethical Features (EPIC 10)

### 🟢 P3 (Low) - Future Work (12+ months)
- Usability Enhancements (EPIC 8)
- External Integrations (EPIC 9)

---

## NEXT STEPS

1. **Review & Prioritization Meeting** con stakeholders
2. **Resource Planning**: assign developers to Epics
3. **Sprint Planning**: break down P0 tasks into 2-week sprints
4. **Kick-off**: start with EPIC 1 Phase 1.1 & EPIC 2 Phase 2.1 in parallel
5. **Weekly Progress Reviews**
6. **Monthly Retrospectives**

---

## ESTIMATED TIMELINE

### MVP (P0) - 6-8 months
- Month 1-2: Setup infrastructure + Fallacy dataset
- Month 3-4: Model training + API + Integration
- Month 5-6: Ontology + Graph DB + Migration
- Month 7-8: Testing + Bug fixes + Documentation

### Full Release v1.0 (P0 + P1) - 12 months
- Month 9-12: Community validation + Graph features + Argument enhancement

### Full Release v2.0 (P0 + P1 + P2) - 18-24 months
- Month 13-24: AI Facilitators + Consensus tools + Democratic layer + Analytics

---

**TOTALE TASKS**: ~90 tasks
**TOTALE EFFORT**: ~400 person-days (~2 person-years)
**RECOMMENDED TEAM**: 3-4 full-time developers + 1 ML engineer + 1 designer

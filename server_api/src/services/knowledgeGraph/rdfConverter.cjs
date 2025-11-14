"use strict";

const axios = require('axios');
const log = require('../../utils/logger.cjs');

/**
 * RDF Converter Service for Your Priorities -> Deliberation Knowledge Graph
 *
 * Converts database entities to RDF triples using the Deliberation Ontology
 * Reference: http://stocastico96.github.io/Deliberation-Knowledge-Graph/
 *
 * Ontology Namespaces:
 * - delib: http://www.semanticweb.org/deliberation-ontology#
 * - foaf: http://xmlns.com/foaf/0.1/
 * - dc: http://purl.org/dc/elements/1.1/
 * - xsd: http://www.w3.org/2001/XMLSchema#
 */

class RDFConverter {
  constructor(config = {}) {
    this.fusekiUrl = config.fusekiUrl || process.env.FUSEKI_URL || 'http://localhost:3030';
    this.dataset = config.dataset || 'deliberation';
    this.baseUri = config.baseUri || process.env.BASE_URI || 'http://yourpriorities.org/kg/';
    this.apiKey = config.apiKey || process.env.FUSEKI_WRITE_API_KEY;

    // Namespace prefixes
    this.prefixes = {
      delib: 'http://www.semanticweb.org/deliberation-ontology#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dc: 'http://purl.org/dc/elements/1.1/',
      dcterms: 'http://purl.org/dc/terms/',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      yp: this.baseUri
    };
  }

  /**
   * Generate URI for an entity
   */
  uri(type, id) {
    return `${this.prefixes.yp}${type}/${id}`;
  }

  /**
   * Escape string for Turtle format
   */
  escapeTurtle(str) {
    if (!str) return '""';
    return JSON.stringify(str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n'));
  }

  /**
   * Format date to xsd:dateTime
   */
  formatDate(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString();
  }

  /**
   * Generate Turtle prefixes
   */
  getTurtlePrefixes() {
    return Object.entries(this.prefixes)
      .map(([prefix, uri]) => `@prefix ${prefix}: <${uri}> .`)
      .join('\n');
  }

  /**
   * Convert Group to RDF (DeliberationProcess)
   *
   * Maps:
   * - Group -> delib:DeliberationProcess
   * - name -> dc:title
   * - objectives -> dc:description
   * - created_at -> dcterms:created
   * - status -> delib:processStatus
   */
  convertGroupToRDF(group) {
    const groupUri = this.uri('group', group.id);
    const title = this.escapeTurtle(group.name);
    const description = this.escapeTurtle(group.objectives || '');
    const createdAt = this.formatDate(group.created_at);
    const status = this.escapeTurtle(group.status);

    let turtle = `${this.getTurtlePrefixes()}\n\n`;

    turtle += `<${groupUri}> a delib:DeliberationProcess ;\n`;
    turtle += `    dc:title ${title} ;\n`;

    if (group.objectives) {
      turtle += `    dc:description ${description} ;\n`;
    }

    if (createdAt) {
      turtle += `    dcterms:created "${createdAt}"^^xsd:dateTime ;\n`;
    }

    turtle += `    delib:processStatus ${status} ;\n`;
    turtle += `    yp:groupId "${group.id}"^^xsd:integer ;\n`;

    if (group.community_id) {
      const communityUri = this.uri('community', group.community_id);
      turtle += `    delib:partOf <${communityUri}> ;\n`;
    }

    // Add counters
    turtle += `    yp:postCount ${group.counter_posts || 0} ;\n`;
    turtle += `    yp:pointCount ${group.counter_points || 0} ;\n`;
    turtle += `    yp:participantCount ${group.counter_users || 0} ;\n`;

    // Remove trailing comma and add period
    turtle = turtle.replace(/;\n$/, '.\n');

    return turtle;
  }

  /**
   * Convert Post to RDF (Contribution/Proposal)
   *
   * Maps:
   * - Post -> delib:Contribution, delib:Proposal
   * - name -> dc:title
   * - description -> dc:description
   * - user_id -> delib:hasAuthor
   * - group_id -> delib:contributesTo
   */
  convertPostToRDF(post) {
    const postUri = this.uri('post', post.id);
    const title = this.escapeTurtle(post.name);
    const description = this.escapeTurtle(post.description);
    const createdAt = this.formatDate(post.created_at);

    let turtle = `${this.getTurtlePrefixes()}\n\n`;

    turtle += `<${postUri}> a delib:Contribution, delib:Proposal ;\n`;
    turtle += `    dc:title ${title} ;\n`;
    turtle += `    dc:description ${description} ;\n`;

    if (createdAt) {
      turtle += `    dcterms:created "${createdAt}"^^xsd:dateTime ;\n`;
    }

    // Link to author (Participant)
    if (post.user_id) {
      const authorUri = this.uri('user', post.user_id);
      turtle += `    delib:hasAuthor <${authorUri}> ;\n`;
    }

    // Link to deliberation process (Group)
    if (post.group_id) {
      const groupUri = this.uri('group', post.group_id);
      turtle += `    delib:contributesTo <${groupUri}> ;\n`;
    }

    turtle += `    yp:postId "${post.id}"^^xsd:integer ;\n`;
    turtle += `    delib:endorsementCount ${post.counter_endorsements_up || 0} ;\n`;
    turtle += `    yp:oppositionCount ${post.counter_endorsements_down || 0} ;\n`;

    // Status
    turtle += `    delib:contributionStatus "${post.status}" ;\n`;

    turtle = turtle.replace(/;\n$/, '.\n');

    return turtle;
  }

  /**
   * Convert Point to RDF (Argument)
   *
   * Maps:
   * - Point -> delib:Argument
   * - content -> dc:description
   * - value (for/against) -> delib:supports / delib:opposes
   * - post_id -> link to Proposal
   */
  convertPointToRDF(point) {
    const pointUri = this.uri('point', point.id);
    const content = this.escapeTurtle(point.content);
    const createdAt = this.formatDate(point.created_at);

    let turtle = `${this.getTurtlePrefixes()}\n\n`;

    turtle += `<${pointUri}> a delib:Argument ;\n`;
    turtle += `    dc:description ${content} ;\n`;

    if (createdAt) {
      turtle += `    dcterms:created "${createdAt}"^^xsd:dateTime ;\n`;
    }

    // Link to author
    if (point.user_id) {
      const authorUri = this.uri('user', point.user_id);
      turtle += `    delib:hasAuthor <${authorUri}> ;\n`;
    }

    // Link to post (supports/opposes relation)
    if (point.post_id) {
      const postUri = this.uri('post', point.post_id);

      // value > 0 means "for" (supports), value < 0 means "against" (opposes)
      if (point.value > 0) {
        turtle += `    delib:supports <${postUri}> ;\n`;
        turtle += `    delib:argumentType "supporting" ;\n`;
      } else {
        turtle += `    delib:opposes <${postUri}> ;\n`;
        turtle += `    delib:argumentType "opposing" ;\n`;
      }
    }

    turtle += `    yp:pointId "${point.id}"^^xsd:integer ;\n`;
    turtle += `    delib:qualityScore ${point.counter_quality_up || 0} ;\n`;

    // Link detected fallacies (if any)
    if (point.data && point.data.fallacies) {
      point.data.fallacies.forEach((fallacy, index) => {
        const fallacyUri = this.uri('fallacy', `${point.id}_${index}`);
        turtle += `    delib:containsFallacy <${fallacyUri}> ;\n`;
      });
    }

    turtle = turtle.replace(/;\n$/, '.\n');

    return turtle;
  }

  /**
   * Convert User to RDF (Participant)
   *
   * Maps:
   * - User -> delib:Participant, foaf:Person
   * - name -> foaf:name
   * - Only public data is exported
   */
  convertUserToRDF(user, options = {}) {
    const userUri = this.uri('user', user.id);
    const name = options.anonymize ? this.escapeTurtle(`User ${user.id}`) : this.escapeTurtle(user.name);
    const createdAt = this.formatDate(user.created_at);

    let turtle = `${this.getTurtlePrefixes()}\n\n`;

    turtle += `<${userUri}> a delib:Participant, foaf:Person ;\n`;
    turtle += `    foaf:name ${name} ;\n`;

    if (createdAt) {
      turtle += `    dcterms:created "${createdAt}"^^xsd:dateTime ;\n`;
    }

    turtle += `    yp:userId "${user.id}"^^xsd:integer ;\n`;

    // Only include public profile data if not anonymized
    if (!options.anonymize && user.description) {
      const description = this.escapeTurtle(user.description);
      turtle += `    dc:description ${description} ;\n`;
    }

    turtle = turtle.replace(/;\n$/, '.\n');

    return turtle;
  }

  /**
   * Convert Fallacy Detection to RDF
   */
  convertFallacyToRDF(pointId, fallacy, index) {
    const fallacyUri = this.uri('fallacy', `${pointId}_${index}`);
    const pointUri = this.uri('point', pointId);

    let turtle = `${this.getTurtlePrefixes()}\n\n`;

    turtle += `<${fallacyUri}> a delib:Fallacy ;\n`;
    turtle += `    delib:fallacyType "${fallacy.type}" ;\n`;

    if (fallacy.confidence) {
      turtle += `    delib:confidence ${fallacy.confidence} ;\n`;
    }

    if (fallacy.explanation) {
      const explanation = this.escapeTurtle(fallacy.explanation);
      turtle += `    dc:description ${explanation} ;\n`;
    }

    turtle += `    delib:detectedIn <${pointUri}> ;\n`;
    turtle = turtle.replace(/;\n$/, '.\n');

    return turtle;
  }

  /**
   * Insert RDF data into Fuseki triplestore
   */
  async insertRDF(turtle, format = 'text/turtle') {
    try {
      const url = `${this.fusekiUrl}/${this.dataset}/data`;

      const headers = {
        'Content-Type': format
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(url, turtle, { headers });

      log.info('RDF data inserted successfully', {
        status: response.status,
        dataset: this.dataset
      });

      return { success: true, status: response.status };
    } catch (error) {
      log.error('Failed to insert RDF data', {
        error: error.message,
        response: error.response?.data,
        dataset: this.dataset
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Batch insert multiple RDF triples
   */
  async batchInsert(turtleArray) {
    const combinedTurtle = `${this.getTurtlePrefixes()}\n\n` +
      turtleArray.map(t => t.replace(this.getTurtlePrefixes(), '').trim()).join('\n\n');

    return this.insertRDF(combinedTurtle);
  }

  /**
   * Query SPARQL endpoint
   */
  async query(sparqlQuery) {
    try {
      const url = `${this.fusekiUrl}/${this.dataset}/query`;

      const response = await axios.post(url, null, {
        params: {
          query: sparqlQuery
        },
        headers: {
          'Accept': 'application/sparql-results+json'
        }
      });

      return {
        success: true,
        results: response.data
      };
    } catch (error) {
      log.error('SPARQL query failed', {
        error: error.message,
        query: sparqlQuery
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete entity from knowledge graph
   */
  async deleteEntity(entityUri) {
    const sparqlUpdate = `
      DELETE WHERE {
        <${entityUri}> ?p ?o .
      }
    `;

    try {
      const url = `${this.fusekiUrl}/${this.dataset}/update`;

      const headers = {
        'Content-Type': 'application/sparql-update'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      await axios.post(url, sparqlUpdate, { headers });

      return { success: true };
    } catch (error) {
      log.error('Failed to delete entity', {
        error: error.message,
        entityUri
      });

      return { success: false, error: error.message };
    }
  }
}

module.exports = RDFConverter;

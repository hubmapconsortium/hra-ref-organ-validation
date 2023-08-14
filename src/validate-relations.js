import { selectCsvRemote, selectRemoteObjects } from './sparql.js';
import Papa from 'papaparse';
import { readFileSync, writeFileSync } from 'fs';

const ENDPOINT = 'https://ubergraph.apps.renci.org/sparql';
const GRAPH = 'http://reasoner.renci.org/redundant';
const INPUT = 'data/ref-organ-relations.csv';
const INVALID = 'data/invalid-ref-organ-relations.csv';
const VALID = 'data/valid-ref-organ-relations.csv';
const REPORT = 'data/README.md';

const PREDICATES = [
  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  'http://purl.obolibrary.org/obo/BFO_0000050',
  'http://purl.obolibrary.org/obo/RO_0001025',
  'http://purl.obolibrary.org/obo/RO_0002100',
];

const edges = Papa.parse(readFileSync(INPUT).toString(), { header: true }).data;
const subjectObject = edges.map((edge) => `( <${edge.s}> <${edge.o}> )`).join(' ');
const predicates = PREDICATES.map((p) => `( <${p}> )`).join(' ');

const query = `
SELECT ?slabel ?plabel ?olabel ?s ?p ?o
#FROM <${GRAPH}>
WHERE {
  VALUES (?s ?o) {
    ${subjectObject}
  }
  #VALUES (?p) {
  #  ${predicates}
  #}

  {
    ?s ?p ?o .
  }

  OPTIONAL { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?slabel . }
  OPTIONAL { ?p <http://www.w3.org/2000/01/rdf-schema#label> ?plabel . }
  OPTIONAL { ?o <http://www.w3.org/2000/01/rdf-schema#label> ?olabel . }
}
`;

const results = await selectRemoteObjects(query, ENDPOINT);
writeFileSync(VALID, Papa.unparse(results, { header: true }));

const validEdges = new Set(results.map((edge) => `( <${edge.s}> <${edge.o}> )`));
const invalidEdges = edges.filter((edge) => !validEdges.has(`( <${edge.s}> <${edge.o}> )`));

writeFileSync(INVALID, Papa.unparse(invalidEdges, { header: true, columns: ['s', 'o'] }));

writeFileSync(
  REPORT,
  `
# HRA v1.4 Validation Report

## Implicit 3D reference organ 'part of' relationships

- [Total relationships](ref-organ-relations.csv): ${results.length}
- [Valid relationships](valid-ref-organ-relations.csv): ${validEdges.size}
- [Invalid relationships](invalid-ref-organ-relations.csv): ${invalidEdges.length}
`
);

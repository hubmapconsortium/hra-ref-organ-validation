import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';
import { SPARQL_PREFIXES, prefix, prefixAll } from './prefixes.js';
import { selectRemoteObjects } from './sparql.js';

const INPUT = 'data/ref-organ-relations.csv';
const INVALID = 'data/invalid-ref-organ-relations.csv';
const VALID = 'data/valid-ref-organ-relations.csv';
const VALIDATION_QUERY = 'data/validate-ref-organ-relations.rq';
const REPORT = 'data/README.md';
const PREDICATES = [
  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  'http://purl.obolibrary.org/obo/BFO_0000050',
  'http://purl.obolibrary.org/obo/RO_0002170',
  'http://purl.obolibrary.org/obo/RO_0002131',
].map(prefix);
const ENDPOINT = 'https://ubergraph.apps.renci.org/sparql';

const edges = Papa.parse(readFileSync(INPUT).toString(), { header: true }).data;
const edgeValues = edges
  .map(({ ref_organ, ref_organ_part, child, parent }) => `( <${ref_organ}> <${ref_organ_part}> ${child} ${parent} )`)
  .join(' ');
const predicates = PREDICATES.map((p) => `( ${p} )`).join(' ');

const query = `
${SPARQL_PREFIXES}

SELECT DISTINCT ?ref_organ ?ref_organ_part ?slabel ?plabel ?olabel ?s ?p ?o
WHERE {
  VALUES (?ref_organ ?ref_organ_part ?s ?o) {
    ${edgeValues}
  }
  VALUES (?p) {
    ${predicates}
  }

  {
    ?s ?p ?o .
  }

  OPTIONAL { ?s rdfs:label ?slabel . }
  OPTIONAL { ?p rdfs:label ?plabel . }
  OPTIONAL { ?o rdfs:label ?olabel . }
}
`;

writeFileSync(VALIDATION_QUERY, query);
const results = (await selectRemoteObjects(query, ENDPOINT)).map(prefixAll).map((result) => {
  // Give a label to rdfs:subClassOf
  if (result.p === 'rdfs:subClassOf') {
    result.plabel = 'is a';
  }
  return result;
});

const edgeToString = (edge) => `( <${edge.s}> <${edge.o}> )`;
const uniqueEdges = new Set(edges.map((input) => edgeToString({ s: input.child, o: input.parent })));
const validUniqueEdges = new Set(results.map(edgeToString));
const invalidUniqueEdges = [...uniqueEdges].filter((edge) => !validUniqueEdges.has(edge));

writeFileSync(
  VALID,
  Papa.unparse(results, {
    header: true,
    columns: ['ref_organ', 'ref_organ_part', 'slabel', 'plabel', 'olabel', 's', 'p', 'o'],
  })
);

writeFileSync(
  INVALID,
  Papa.unparse(
    edges.filter((input) => validUniqueEdges.has(edgeToString({ s: input.child, o: input.parent }))),
    { header: true, columns: ['ref_organ', 'ref_organ_part', 'parent', 'child'] }
  )
);

writeFileSync(
  REPORT,
  `
# HRA v2.1 Validation Report

## Implicit 3D reference organ 'part of' relationships

- [Valid relationships](valid-ref-organ-relations.csv): ${validUniqueEdges.size}
- [Invalid relationships](invalid-ref-organ-relations.csv): ${invalidUniqueEdges.length}
- [Total relationships](ref-organ-relations.csv): ${uniqueEdges.size}
`
);

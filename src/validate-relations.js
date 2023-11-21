import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';
import { SPARQL_PREFIXES, prefix, prefixAll } from './prefixes.js';
import { selectRemoteObjects } from './sparql.js';

const INPUT = 'data/ref-organ-relations.csv';
const INVALID = 'data/invalid-ref-organ-relations.csv';
const VALID = 'data/valid-ref-organ-relations.csv';
const VALIDATION_QUERY = 'data/validate-ref-organ-relations.rq';
const REVERSED = 'data/reversed-ref-organ-relations.csv';
const REPORT = 'data/README.md';
const PREDICATES = [
  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  'http://purl.obolibrary.org/obo/BFO_0000050',
  'http://purl.obolibrary.org/obo/RO_0002170',
].map(prefix);
const ENDPOINT = 'https://ubergraph.apps.renci.org/sparql';

const edges = Papa.parse(readFileSync(INPUT).toString(), { header: true }).data;
const edgeValues = edges
  .map(({ ref_organ, ref_organ_part, child, parent }) => `( <${ref_organ}> <${ref_organ_part}> <${child}> <${parent}> )`)
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
    edges.filter((input) => !validUniqueEdges.has(edgeToString({ s: input.child, o: input.parent }))),
    { header: true, columns: ['ref_organ', 'ref_organ_part', 'parent', 'child', 'parent_label', 'child_label'] }
  )
);

function renameKey(key) {
  if (key === "child") 
    return "parent"
  else if (key === "parent")
    return "child"
  return key
}
const parsed = Papa.parse(readFileSync(INVALID).toString(), { header: true, transformHeader: renameKey });
const edges_ = parsed.data;

const edgeValues_ = edges_
  .map(({ ref_organ, ref_organ_part, child, parent }) => `( <${ref_organ}> <${ref_organ_part}> <${child}> <${parent}> )`)
  .join(' ');

const query_ = `
  ${SPARQL_PREFIXES}
  
  SELECT DISTINCT ?ref_organ ?ref_organ_part ?slabel ?plabel ?olabel ?s ?p ?o
  WHERE {
    VALUES (?ref_organ ?ref_organ_part ?s ?o) {
      ${edgeValues_}
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
  
writeFileSync(VALIDATION_QUERY, query_);
const results_ = (await selectRemoteObjects(query_, ENDPOINT)).map(prefixAll).map((result) => {
  // Give a label to rdfs:subClassOf
  if (result.p === 'rdfs:subClassOf') {
    result.plabel = 'is a';
  }
  return result;
});
const uniqueEdges_ = new Set(edges_.map((input) => edgeToString({ s: input.child, o: input.parent })));
const validUniqueEdges_ = new Set(results_.map(edgeToString));
const invalidUniqueEdges_ = [...uniqueEdges_].filter((edge) => !validUniqueEdges_.has(edge));

writeFileSync(
  REVERSED,
  Papa.unparse(results_, {
    header: true,
    columns: ['ref_organ', 'ref_organ_part', 'slabel', 'plabel', 'olabel', 's', 'p', 'o'],
  })
);

writeFileSync(
  REPORT,
  `
# HRA v1.4 Validation Report (Only UBERON terms)

## Implicit 3D reference organ 'part of' relationships

- [Valid relationships](valid-ref-organ-relations.csv): ${validUniqueEdges.size}
- [Invalid relationships](invalid-ref-organ-relations.csv): ${invalidUniqueEdges.length}
- [Reversed valid relationships](reversed-ref-organ-relations.csv): ${validUniqueEdges_.size}
- [Total relationships](ref-organ-relations.csv): ${uniqueEdges.size}
`
);

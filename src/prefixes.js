export const PREFIX_MAP = {
  ccf: 'http://purl.org/ccf/latest/ccf.owl#',
  UBERON: 'http://purl.obolibrary.org/obo/UBERON_',
  CL: 'http://purl.obolibrary.org/obo/CL_',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  fma: 'http://purl.org/sig/ont/fma/',
  BFO: 'http://purl.obolibrary.org/obo/BFO_',
  RO: 'http://purl.obolibrary.org/obo/RO_'
};

export const SPARQL_PREFIXES = Object.entries(PREFIX_MAP).map(([code, prefix]) => `PREFIX ${code}: <${prefix}>`).join('\n');

export function prefix(iri) {
  return Object.entries(PREFIX_MAP).reduce((iri, [code, prefix]) => iri.replace(prefix, code + ':'), iri);
}

export function prefixAll(object) {
  return Object.entries(object).reduce((acc, [key, value]) => ((acc[key] = prefix(value)), acc), {});
}

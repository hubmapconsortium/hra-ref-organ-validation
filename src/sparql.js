import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint';
import Papa from 'papaparse';

/**
 * Generator that returns SPARQL query results as an array of simple objects
 *
 * @param {string} query the SPARQL query as a string
 * @param {string} sparqlEndpoint the remote SPARQL endpoint to query
 * @returns array of objects
 */
export async function selectRemoteObjects(query, sparqlEndpoint) {
  const fetcher = new SparqlEndpointFetcher({});
  const stream = await fetcher.fetchBindings(sparqlEndpoint, query);
  return new Promise((resolve, reject) => {
    const results = [];
    stream.on('data', (bindings) => {
      const result = Object.keys(bindings).reduce((acc, key) => ((acc[key] = bindings[key]?.value), acc), {});
      results.push(result);
    });
    stream.on('end', () => {
      resolve(results);
    });
  });
}

/**
 * Run a SPARQL query and return results in csv format
 *
 * @param {string} query the SPARQL query as a string
 * @param {string} sparqlEndpoint the remote SPARQL endpoint to query
 * @returns the results of the query in csv format
 */
export async function selectCsvRemote(query, sparqlEndpoint) {
  const data = await selectRemoteObjects(query, sparqlEndpoint);
  return Papa.unparse(data);
}

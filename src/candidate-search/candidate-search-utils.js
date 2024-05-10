import createDebugLogger from 'debug';

export function toQueries(identifiers, queryString) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:toQueries');
  const debugData = debug.extend('data');

  const quotedIdentifiers = identifiers.map(identifier => identifier.match(/\//u) ? `"${identifier}"` : `${identifier}`);

  // Aleph supports only two queries with or -operator (This is not actually true)
  const pairs = toPairs(quotedIdentifiers);
  const queries = pairs.map(([a, b]) => b ? `${queryString}=${a} or ${queryString}=${b}` : `${queryString}=${a}`);

  debugData(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);
  debugData(`Queries (${queries.length}): ${JSON.stringify(queries)}`);

  return queries;
}

function toPairs(array) {
  if (array.length === 0) {
    return [];
  }
  return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
}

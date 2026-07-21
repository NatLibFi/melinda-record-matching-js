import createDebugLogger from 'debug';

export function toQueries(identifiers, queryString) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:toQueries');
  const debugData = debug.extend('data');

  // We quote the identifier, if it contains a slash! (Slash in non-quoted SRU-search breaks search.)
  // We also quote the identifier, if it starts with caret (f028 searches fail without caret and quotes...)
  const quotedIdentifiers = identifiers.map(identifier => identifier.match(/\//u) || identifier.match(/\^/u) ? `"${identifier}"` : `${identifier}`);

  // We can't pair queries with starting caret and without (ie. left anchored queries with non-left anchored queries)
  const caretPairs = toPairs(quotedIdentifiers.filter(identifier => identifier.match(/\^/u)));
  const nonCaretPairs = toPairs(quotedIdentifiers.filter(identifier => !identifier.match(/\^/u)));

  const pairs = nonCaretPairs.concat(caretPairs);
  debugData(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);

  // Aleph supports only two queries with or -operator (This is not actually true)
  const queries = pairs.map(([a, b]) => b ? `${queryString}=${a} or ${queryString}=${b}` : `${queryString}=${a}`);
  debugData(`Queries (${queries.length}): ${JSON.stringify(queries)}`);

  return queries;
}

function toPairs(array) {
  if (array.length === 0) {
    return [];
  }
  return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
}

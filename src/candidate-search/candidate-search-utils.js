import createDebugLogger from 'debug';

export function toQueries(identifiers, queryString) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:toQueries');
  const debugData = debug.extend('data');
  const debugDev = debug.extend('dev');

  // For dc.identifier search use max length of 60 characters
  const useMaxLength = queryString === 'dc.identifier' ? true : false;
  const maxLength = 60;

  // We quote the identifier, if it contains a slash! (Slash in non-quoted SRU-search breaks search.)
  // We also quote the identifier, if it starts with caret (f028 searches fail without caret and quotes...)
  const quotedIdentifiers = identifiers.map(identifier => identifier.match(/\//u) || identifier.match(/\^/u) ? `"${identifier}"` : `${identifier}`);

  // We can't pair queries with starting caret and without (ie. left anchored queries with non-left anchored queries)
  const caretPairs = toPairs(quotedIdentifiers.filter(identifier => identifier.match(/\^/u)));
  const nonCaretPairs = toPairs(quotedIdentifiers.filter(identifier => !identifier.match(/\^/u)));

  const pairs = nonCaretPairs.concat(caretPairs);
  debugData(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);

  // Aleph supports only two queries with or -operator (This is not actually true)
  const queries = pairs.map(([a, b]) => {
    const lengths = a.length + (b ? b.length : 0);
    debugDev(`Lengths: ${a} (${a.length}) + ${b} (${b ? b.length : 0}) = ${lengths}`);

    // Do not create a paired query if query length would be too long
    // Note: single too long identifier will still crash the queries
    // DEVELOP: check if the length crash is related to mapping the query to multiple Aleph indexes
    if (useMaxLength && lengths > maxLength && a && b) {
      return [`${queryString}=${a}`, `${queryString}=${b}`];
    }
    return b ? `${queryString}=${a} or ${queryString}=${b}` : `${queryString}=${a}`}
  );

  debugData(`Queries (${queries.length}): ${JSON.stringify(queries)}`);
  const flatQueries = queries.flat();
  debugData(`FlatQueries (${flatQueries.length}): ${JSON.stringify(flatQueries)}`);

  return flatQueries;
}

function toPairs(array) {
  if (array.length === 0) {
    return [];
  }
  return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
}


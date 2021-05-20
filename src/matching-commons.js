/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Melinda record matching modules for Javascript
*
* Copyright (C) 2020 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-matching-js
*
* melinda-record-matching-js program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-matching-js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import createDebugLogger from 'debug';

// eslint-disable-next-line max-statements
export function getMelindaIdsF035(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:melinda-id');
  const debugData = debug.extend('data');

  const f035s = record.getFields('035');

  if (f035s.length < 1) {
    debug(`No f035s found.`);
    return [];
  }

  const allF035MelindaIds = [].concat(...f035s.map(toMelindaIds));
  const f035MelindaIds = [...new Set(allF035MelindaIds)];

  debugData(`Fields (${f035s.length}): ${JSON.stringify(f035s)}`);
  debugData(`Ids (${allF035MelindaIds.length}): ${JSON.stringify(allF035MelindaIds)}`);
  debugData(`Unique ids (${f035MelindaIds.length}): ${JSON.stringify(f035MelindaIds)}`);

  return f035MelindaIds;

  function toMelindaIds({subfields}) {
    const melindaIdRegExp = /^(?<prefix>\(FI-MELINDA\)|FCC)(?<id>\d{9})$/u;

    return subfields
      .filter(sub => ['a', 'z'].includes(sub.code))
      .filter(sub => melindaIdRegExp.test(sub.value))
      .map(({value}) => value.replace(melindaIdRegExp, '$<id>'));

  }
}

export function toPairs(array) {
  if (array.length === 0) {
    return [];
  }
  return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
}

export function toQueries(identifiers, queryString) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:toQueries');
  const debugData = debug.extend('data');

  // Aleph supports only two queries with or -operator (This is not actually true)
  const pairs = toPairs(identifiers);
  const queries = pairs.map(([a, b]) => b ? `${queryString}=${a} or ${queryString}=${b}` : `${queryString}=${a}`);

  debugData(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);
  debugData(`Queries (${queries.length}): ${JSON.stringify(queries)}`);

  return queries;
}

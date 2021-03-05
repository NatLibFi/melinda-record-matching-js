
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
import {getMelindaIdsF035} from '../../matching-commons';


export function bibMelindaIds(record) {
  // Melinda's SRU-index melinda.melindaid includes f001 controlnumbers and old Melinda-IDs from f035z's for all non-deleted Melinda-records

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibMelindaIds');
  const debugData = debug.extend('data');
  debug(`Creating queries for MelindaIds`);

  // Note: Melinda-ID's for search queries are created just from records f035a's and f035z's
  // Both (FI-MELINDA)- and FCC-prefixed forms are found
  // f001 controlnumber is not currently included, even if record's f003 is FI-MELINDA
  const melindaIds = getMelindaIdsF035(record);

  debugData(`Unique identifiers (${melindaIds.length}): ${JSON.stringify(melindaIds)}`);

  if (melindaIds.length < 1) {
    debug(`No identifiers found, no queries created.`);
    return [];
  }

  return toQueries(melindaIds);

  function toQueries(identifiers) {
    // Aleph supports only two queries with or -operator (This is not actually true)
    const pairs = toPairs(identifiers);
    const queries = pairs.map(([a, b]) => b ? `melinda.melindaid=${a} or melinda.melindaid=${b}` : `melinda.melindaid=${a}`);

    debugData(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);
    debugData(`Queries (${queries.length}): ${JSON.stringify(queries)}`);

    return queries;

    function toPairs(array) {
      if (array.length === 0) {
        return [];
      }
      return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
    }
  }
}


// bibHostComponents returns host id from the first subfield $w of first field f773, see test-fixtures 04 and 05
// bibHostComponents should search all 773 $ws for possible host id, but what should it do in case of multiple host ids?
export function bibHostComponents(record) {
  const id = getHostId();
  return id ? [`melinda.partsofhost=${id}`] : [];

  function getHostId() {
    const [field] = record.get(/^773$/u);

    if (field) {
      const {value} = field.subfields.find(({code}) => code === 'w') || {};

      if (value && (/^\(FI-MELINDA\)/u).test(value)) {
        return value.replace(/^\(FI-MELINDA\)/u, '');
      }

      if (value && (/^\(FIN01\)/u).test(value)) {
        return value.replace(/^\(FIN01\)/u, '');
      }

      return false;
    }
    return false;
  }
}

export function bibTitle(record) {
  const title = getTitle();

  if (title) {
    const formatted = title
      .replace(/[^\w\s\p{Alphabetic}]/gu, '')
      .trim()
      .slice(0, 30)
      .trim();

    // Prevent too many matches by having a minimum length requirement
    return formatted.length >= 5 ? [`dc.title="^${formatted}*"`] : [];
  }

  return [];

  function getTitle() {
    const [field] = record.get(/^245$/u);

    if (field) {
      return field.subfields
        .filter(({code}) => ['a', 'b'].includes(code))
        .map(({value}) => value)
        .join('');
    }
    return false;
  }
}

// Aleph supports only two queries with or -operator (This is not true,)
// eslint-disable-next-line max-statements
export function bibStandardIdentifiers(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibStandardIdentifiers');
  debug(`Creating queries for standard identifiers`);

  const fields = record.get(/^(?<def>020|022|024)$/u);
  const identifiers = fields.map(toIdentifiers);
  const pairs = identifiers.reduce(toPairs, []);

  return pairs.map(([a, b]) => b ? `dc.identifier=${a} or dc.identifier=${b}` : `dc.identifier=${a}`);

  function toIdentifiers({tag, subfields}) {
    const issnIsbnReqExp = (/^[A-Za-z0-9-]+$/u);

    if (tag === '022') {
      return subfields
        .filter(sub => ['a', 'z', 'y'].includes(sub.code) && issnIsbnReqExp.test(sub.value) && sub.value !== undefined)
        .map(({value}) => value);
    }

    if (tag === '020') {
      return subfields
        .filter(sub => ['a', 'z'].includes(sub.code) && issnIsbnReqExp.test(sub.value) && sub.value !== undefined)
        .map(({value}) => value);
    }

    return subfields
      .filter(sub => ['a', 'z'].includes(sub.code) && sub.value !== undefined)
      .map(({value}) => value);
  }

  function toPairs(results, identifier) {

    const [tail] = results.slice(-1);

    if (tail) {
      if (tail.length === 2) {
        return results.concat([[identifier]]);
      }

      const head = results.slice(0, -1);
      return head.concat([tail.concat(identifier)]);
    }

    return results.concat([identifier]);
  }
}

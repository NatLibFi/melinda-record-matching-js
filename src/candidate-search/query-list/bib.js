
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

// eslint-disable-next-line max-statements
export function bibStandardIdentifiers(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibStandardIdentifiers');
  debug(`Creating queries for standard identifiers`);

  const fields = record.get(/^(?<def>020|022|024)$/u);
  const identifiers = [].concat(...fields.map(toIdentifiers));
  const uniqueIdentifiers = [...new Set(identifiers)];

  debug(`Identifiers (${identifiers.length}): ${JSON.stringify(identifiers)}`);
  debug(`Standard identifier fields: ${JSON.stringify(fields)}`);
  debug(`Unique identifiers (${uniqueIdentifiers.length}): ${JSON.stringify(uniqueIdentifiers)}`);

  if (uniqueIdentifiers.length < 1) {
    return [];
  }

  return toQueries(uniqueIdentifiers);

  function toQueries(identifiers) {
    // Aleph supports only two queries with or -operator (This is not actually true)
    const pairs = toPairs(identifiers);
    const queries = pairs.map(([a, b]) => b ? `dc.identifier=${a} or dc.identifier=${b}` : `dc.identifier=${a}`);

    debug(`Pairs (${pairs.length}): ${JSON.stringify(pairs)}`);
    debug(`Queries (${queries.length}): ${JSON.stringify(queries)}`);

    return queries;

    function toPairs(array) {
      if (array.length === 0) {
        return [];
      }
      return [array.slice(0, 2)].concat(toPairs(array.slice(2), 2));
    }
  }

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
}

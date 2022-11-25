/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Melinda record matching modules for Javascript
*
* Copyright (C) 2020-2022 University Of Helsinki (The National Library Of Finland)
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
import {testStringOrNumber} from '../../../matching-utils';


export default ({pattern, subfieldCodes, identifier}) => {
  const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:${identifier}`);
  const debugData = debug.extend('data');

  return {extract, compare};

  function extract({record, recordExternal}) {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const fields = record.get(pattern);
    const [field] = fields;
    debug(`${label} has ${fields.length} {${identifier}}-fields `);

    if (field) {
      return field.subfields
        .filter(({code}) => subfieldCodes.includes(code))
        .map(({code, value}) => ({code, value: testStringOrNumber(value) ? String(value).replace(/-/ug, '') : ''}))
        .filter(value => value);
    }

    return [];
  }

  function compare(a, b) {
    if (a.length === 0 || b.length === 0) {
      debugData(`No standardidentifiers to compare`);
      return 0;
    }

    if (bothHaveValidIdentifiers()) {
      const {maxValues, matchingValues} = getValueCount(true);
      if (matchingValues < 1) {
        return -0.75;
      }
      return matchingValues / maxValues * 0.75;
    }

    const {maxValues, matchingValues} = getValueCount();
    return matchingValues / maxValues * 0.2;

    function bothHaveValidIdentifiers() {
      const aValues = a.filter(({code}) => code === 'a');
      const bValues = a.filter(({code}) => code === 'a');
      return aValues.length > 0 && bValues.length > 0;
    }

    function getValueCount(validOnly = false) {
      const aValues = getIdentifiers(a);
      const bValues = getIdentifiers(b);

      return {
        maxValues: aValues.length > bValues.length ? aValues.length : bValues.length,
        matchingValues: aValues.filter(aValue => bValues.some(bValue => aValue === bValue)).length
      };

      function getIdentifiers(values) {
        if (validOnly) {
          return values
            .filter(({code}) => code === 'a')
            .map(({value}) => value);
        }

        return values.map(({value}) => value);
      }
    }
  }
};

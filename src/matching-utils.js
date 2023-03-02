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

const debug = createDebugLogger('@natlibfi/melinda-record-matching:utils');
const debugData = debug.extend('data');

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
      .filter(sub => testStringOrNumber(sub.value) && melindaIdRegExp.test(String(sub.value)))
      .map(({value}) => testStringOrNumber(value) ? String(value).replace(melindaIdRegExp, '$<id>') : '');

  }
}

export function validateSidFieldSubfieldCounts(field) {
  // Valid SID-fields have just one $c and one $b
  debugData(`Validating SID field ${JSON.stringify(field)}`);
  const countC = countSubfields(field, 'c');
  const countB = countSubfields(field, 'b');
  debug(`Found ${countC} sf $cs and ${countB} sf $bs. IsValid: ${countC === 1 && countB === 1}`);

  return countC === 1 && countB === 1;
}

function countSubfields(field, subfieldCode) {
  // debug(`Counting subfields ${subfieldCode}`);
  return field.subfields.filter(({code}) => code === subfieldCode).length;
}

export function getSubfieldValues(field, subfieldCode) {
  debugData(`Get subfield(s) $${subfieldCode} from ${JSON.stringify(field)}`);
  return field.subfields
    .filter(({code}) => code === subfieldCode)
    .map(({value}) => testStringOrNumber(value) ? String(value) : '')
    .filter(value => value);
}

export function testStringOrNumber(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return true;
  }
  return false;
}

export function extractSubfieldsFromField(field, subfieldCodes) {
  if (field === undefined || field.subfields === undefined) {
    return [];
  }
  const resultSubfields = field.subfields
    .filter(({code}) => subfieldCodes.includes(code))
    .map(({code, value}) => ({code, value: testStringOrNumber(value) ? String(value) : ''}))
    .filter(value => value);
  return resultSubfields;
}

export function uniqueSubfields(subfields) {
  return subfields.reduce((arr, e) => {
    if (!arr.find(item => item.code === e.code && item.value === e.value)) {
      const newArr = arr.concat(e);
      return newArr;
    }
    return arr;
  }, []);
}

export function getMatchCounts(aValues, bValues) {

  const matchingValues = getMatchingValuesAmount(aValues, bValues);

  return {
    maxValues: aValues.length > bValues.length ? aValues.length : bValues.length,
    // possibleMatchingValues: amount of identifiers in set of less identifiers (we cannot more values than these)
    possibleMatchValues: aValues.length > bValues.length ? bValues.length : aValues.length,
    matchingValues
  };

  function getMatchingValuesAmount(aValues, bValues) {
    if (bValues.length > aValues.length) {
      return aValues.filter(aValue => bValues.some(bValue => aValue === bValue)).length;
    }
    if (aValues.length > bValues.length) {
      return bValues.filter(bValue => aValues.some(aValue => bValue === aValue)).length;
    }

    // If we have same amount of values, we'll check matches both ways, to avoid mixups in cases
    // there would be duplicate values
    const aToB = aValues.filter(aValue => bValues.some(bValue => aValue === bValue)).length;
    const bToA = bValues.filter(bValue => aValues.some(aValue => bValue === aValue)).length;

    return aToB < bToA ? aToB : bToA;
  }
}

/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Melinda record matching modules for Javascript
*
* Copyright (C) 2020-2023 University Of Helsinki (The National Library Of Finland)
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
import {getMatchCounts} from '../../../matching-utils';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:language');
const debugData = debug.extend('data');

export default () => ({
  name: 'Language',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    const value008 = get008Value();
    const values041 = get041Values();
    debugData(`${label} 008: ${JSON.stringify(value008)}, 041: ${JSON.stringify(values041)}`);

    /*
    if (value008 && values041.length > 0) {
      debugData(`${label} There's both 008 and 041, searching for value in both`);
      const correspondingValue = values041.find(v => v === value008);
      debugData(`${label} Corresponding value: ${correspondingValue}`);
      return correspondingValue ? [correspondingValue] : [];
    }
    */

    if (!value008 && values041.length < 1) {
      debugData(`{$label} No actual values found`);
      return [];
    }

    const allValues = value008 === undefined ? values041 : values041.concat(value008);
    const uniqueSortedValues = [...new Set(allValues)].sort();

    return uniqueSortedValues;

    function get008Value() {
      const value = record.get(/^008$/u)?.[0]?.value || undefined;
      debugData(`${label} 008 value: ${value}`);

      if (!value) {
        return undefined;
      }

      const code = value.slice(35, 38);
      debugData(`${label} 008 code: ${code}`);
      return isLangCodeForALanguage(code) ? code : undefined;
    }

    // Uses only f041s that have 2nd ind ' ', which means that the codes used are MARC 21 language codes

    function get041Values() {
      return record.get(/^041$/u)
        .filter(({ind2}) => ind2 === ' ')
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'a' || code === 'd')
        .filter(({value}) => value && isLangCodeForALanguage(value))
        .map(({value}) => value);
    }

    // Check if a string is a possible, validly formed language code for a single language
    // Currently accept also codes in capitals
    function isLangCodeForALanguage(code) {
      if (code.length !== 3) {
        debugData(`Code ${code} is not correct length (3) for a language code.`);
        return false;
      }
      if (code === '|||' || code === '   ' || code === '^^^' || code === 'mul' || code === 'zxx') {
        debugData(`Code ${code} is not code for a spesific language.`);
        return false;
      }
      const langCodePattern = /^[a-z][a-z][a-z]$/ui;
      if (!langCodePattern.test(code)) {
        debugData(`Code ${code} is not valid as a language code`);
        return false;
      }
      return true;
    }

  },
  // eslint-disable-next-line max-statements
  compare: (a, b) => {
    debugData(`Comparing ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

    if (a.length === 0 || b.length === 0) {
      debugData(`No language to compare`);
      return 0;
    }

    if (a.length === b.length && a.every((element, index) => element === b[index])) {
      debugData(`All languages match`);
      return 0.1;
    }

    const {matchingValues, possibleMatchValues, maxValues} = getMatchCounts(a, b);

    if (matchingValues < 1) {
      debug(`Both have languages, but none of these match.`);
      return -1.0;
    }
    debug(`Both have languages, ${matchingValues}/${possibleMatchValues} valid languages match.`);
    // ignore non-matches if there is mismatching amount of values
    debug(`Possible matches: ${possibleMatchValues}/${maxValues}`);
    //we give some kind of penalty for mismatching amount of values instead of simple divide?
    const missingCount = maxValues - possibleMatchValues;
    const misMatchCount = possibleMatchValues - matchingValues;
    debug(`\t missing: ${missingCount}`);
    debug(`\t mismatches: ${misMatchCount}`);

    const penaltyForMissing = 0.02 * (maxValues - possibleMatchValues);
    const penaltyForMisMatch = 0.05 * (possibleMatchValues - matchingValues);
    debug(`\t points: penaltyForMissing: ${penaltyForMissing}`);
    debug(`\t points: penaltyForMisMatch: ${penaltyForMisMatch}`);

    const points = Number(Number(0.1 - penaltyForMisMatch - penaltyForMissing).toFixed(2));
    debug(`Total points: ${points}`);

    return points;
  }
});

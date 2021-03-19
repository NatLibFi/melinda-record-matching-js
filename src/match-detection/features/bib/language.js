/* eslint-disable max-statements */
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

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:language');
const debugData = debug.extend('data');

export default () => ({
  name: 'Language',
  extract: record => {
    const value008 = get008Value();
    const values041 = get041Values();
    debugData(`008: ${JSON.stringify(value008)}, 041: ${JSON.stringify(values041)}`);

    if (value008 && values041.length > 0) {
      debugData(`There's both 008 and 041, searching for value in both`);
      const correspondingValue = values041.find(v => v === value008);
      debugData(`Corresponding value: ${correspondingValue}`);
      return correspondingValue ? [correspondingValue] : [];
    }

    if (!value008 && values041.length < 1) {
      debugData(`No actual values found`);
      return [];
    }

    return value008 ? [value008] : [values041[0]];

    function get008Value() {
      const value = record.get(/^008$/u)?.[0]?.value || undefined;
      debugData(`008 value: ${value}`);

      if (!value) {
        return undefined;
      }

      const code = value.slice(35, 38);
      debugData(`008 code: ${code}`);
      return code === '|||' || code === '   ' || code === '^^^' ? undefined : code;
    }

    // Main language for the resource: in the first f041 $a or f041 $d
    // Uses only f041s that have 2nd ind ' ', which means that the codes used are MARC 21 language codes

    function get041Values() {
      return record.get(/^041$/u)
        .filter(({ind2}) => ind2 === ' ')
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'a' || code === 'd')
        .map(({value}) => value);
    }
  },
  compare: (a, b) => {
    debugData(`Comparing ${JSON.stringify(a[0])} and ${JSON.stringify(b[0])}`);

    if (a.length === 0 || b.length === 0) {
      debugData(`No language to compare`);
      return 0;
    }

    debugData(`There area languages to compare`);

    if (a[0] === b[0]) {
      return 0.1;
    }

    return a[0] === 'und' || b[0] === 'und' ? 0.0 : -1.0;
  }
});

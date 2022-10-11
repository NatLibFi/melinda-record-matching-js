/* eslint-disable max-statements */
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

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:media-type');
const debugData = debug.extend('data');

export default () => ({
  name: 'Media type',
  extract: record => {
    const values337 = get337Values();
    debugData(`337 $b values: ${JSON.stringify(values337)}`);

    return values337;

    function get337Values() {
      return record.get(/^337$/u)
        .filter(f => f.subfields.some((subfield) => subfield.code === '2' && subfield.value === 'rdamedia'))
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'b')
        .map(({value}) => value);
    }
  },
  compare: (a, b) => {
    debugData(`Comparing ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

    // Should we give extra good points if all mediaTypes match?
    // Should we give partial points for partially matching mediaTypes?
    // Should we check whether recordType is 'mixedMaterials'
    // Should we okay typical cases of not totally matching mediaTypes? What would these be?

    if (a.every(elem => b.includes(elem))) {
      debug(`All mediaTypes from A are in B`);
      return 1;
    }

    if (b.every(elem => a.includes(elem))) {
      debug(`All mediaTypes from B are in A`);
      return 1;
    }

    debug(`Mismatch in mediaTypes between A and B`);
    return -1;

  }
});

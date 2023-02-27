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

import {testStringOrNumber} from '../../../matching-utils';
import createDebugLogger from 'debug';

// We should also get copyright time and copyright/publication times from 26x
// We should also get publishing time type from f008
// We should get reprint times from f500 $a "Lisäpainos/Lisäpainokset:"

export default () => ({
  name: 'Publication time, allow consequent years, years from multiple sources',
  extract: ({record}) => {
    const value = record.get(/^008$/u)?.[0]?.value || undefined;
    return testStringOrNumber(value) ? [String(value).slice(7, 11)] : [];
  },
  compare: (a, b) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/publication-time-allow-cons-years-multi');
    debug(`Comparing ${a[0]} to ${b[0]}`);

    const [firstA] = a;
    const [firstB] = b;

    if (firstA === firstB) {
      return 0.1;
    }

    const firstANumber = parseInt(firstA, 10);
    const firstBNumber = parseInt(firstB, 10);

    if (isNaN(firstANumber) || isNaN(firstBNumber)) {
      return -1;
    }

    // Handle consequent years as a match
    // see publication-time for a version that does not handle consequent years as a match
    return firstANumber + 1 === firstBNumber || firstANumber - 1 === firstBNumber ? 0.1 : -1;
  }
});

// https://www.loc.gov/marc/bibliographic/bd008.html
// field 008
// 06 - Type of date/Publication status
// 07-10 - Date 1
// 11-14 - Date 2
//
// 06 - Type of date/Publication status
// b - No dates given; B.C. date involved
// c - Continuing resource currently published
// d - Continuing resource ceased publication
// e - Detailed date
// i - Inclusive dates of collection
// k - Range of years of bulk of collection
// m - Multiple dates
// n - Dates unknown
// p - Date of distribution/release/issue and production/recording session when different
// q - Questionable date
// r - Reprint/reissue date and original date
// s - Single known date/probable date
// t - Publication date and copyright date
// u - Continuing resource status unknown
// | - No attempt to code
//
// 07-10 - Date 1
// 1-9 - Date digit
// # - Date element is not applicable
// u - Date element is totally or partially unknown
// |||| - No attempt to code
//
// 11-14 - Date 2
// 1-9 - Date digit
// # - Date element is not applicable
// u - Date element is totally or partially unknown
// |||| - No attempt to code
//


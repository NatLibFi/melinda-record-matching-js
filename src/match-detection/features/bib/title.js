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


import {LevenshteinDistance as leven} from 'natural';
import {testStringOrNumber} from '../../../matching-utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:title');
const debugData = debug.extend('data');


export default ({treshold = 10} = {}) => ({
  name: 'Title',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const title = getTitle();
    debug(`${label} title: ${title}`);

    if (testStringOrNumber(title)) {
      const titleAsNormalizedString = String(title)
        // decompose unicode diacritics
        .normalize('NFD')
        // strip non-letters/numbers
        // - note: combined with decomposing unicode diactics this normalizes both 'saa' and 'sää' as 'saa'
        // - we could precompose the finnish letters back to avoid this
        .replace(/[^\p{Letter}\p{Number}]/gu, '')
        .toLowerCase();
      debug(`${label} titleString: ${titleAsNormalizedString}`);
      return [titleAsNormalizedString];
    }

    return [];

    function getTitle() {
      const [field] = record.get(/^245$/u);
      debugData(`${label} titleField: ${JSON.stringify(field)}`);

      if (field) {
        return field.subfields
          // get also $n:s and $p:s here
          .filter(({code}) => ['a', 'b', 'n', 'p'].includes(code))
          .map(({value}) => testStringOrNumber(value) ? String(value) : '')
          .join('');
      }
      return false;
    }
  },
  compare: (a, b) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/title');
    const distance = leven(a[0], b[0]);

    if (distance === 0) {
      return 0.5;
    }

    const maxLength = getMaxLength();
    const percentage = distance / maxLength * 100;

    debug(`'${a}' vs '${b}': Max length = ${maxLength}, distance = ${distance}, percentage = ${percentage}`);

    if (percentage <= treshold) {
      return 0.3;
    }

    return -0.5;

    function getMaxLength() {
      return a[0].length > b[0].length ? a[0].length : b[0].length;
    }

  }
});

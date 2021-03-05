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
import {getMelindaIds} from '../../../matching-commons';

// 003+001 FI-MELINDA <melinda-id>
// 035 $a (FI-MELINDA)<melinda-id>
// 035 $z (FI-MELINDA)<melinda-id>
// 035 $a FCC<melinda-id>
// 035 $z FCC<melinda-id>
// melinda-id = 001234567

export default () => {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/melinda-id');
  const debugData = debug.extend('data');

  return {extract, compare};

  function extract(record) {

    const isMelindaRecord = record.get('003').some(f003 => f003.value === 'FI-MELINDA');
    const [f001] = record.get('001').map(field => field.value);
    const f035MelindaIds = getMelindaIds(record);

    if (
      isMelindaRecord === undefined &&
      f001 === undefined &&
      f035MelindaIds.length < 1) {

      debug(`No Melinda-IDs found`);
      return {};
    }

    return {isMelindaRecord, f001, f035MelindaIds};

  }

  // eslint-disable-next-line max-statements
  function compare(a, b) {

    if (a.isMelindaRecord && b.isMelindaRecord &&
        a.f001 === b.f001) {
      debugData(`Melinda record's A f001 ${a.f001} matches Melinda record's B f001 ${a.f001}`);
      return 1;
    }

    if (a.isMelindaRecord && typeof b.f035MelindaIds !== 'undefined' &&
        b.f035MelindaIds.some(id => id === a.f001)) {
      debugData(`Melinda record's A f001 ${a.f001} matches record B f035 ${JSON.stringify(b.f035MelindaIds)}`);
      return 1;
    }

    if (b.isMelindaRecord && typeof a.f035MelindaIds !== 'undefined' &&
        a.f035MelindaIds.some(id => id === b.f001)) {
      debugData(`Melinda record's B f001 ${b.f001} matches record A f035 ${JSON.stringify(a.f035MelindaIds)}`);
      return 1;
    }

    if (typeof a.f035MelindaIds !== 'undefined' && typeof b.f035MelindaIds !== 'undefined' &&
         a.f035MelindaIds.some(idA => b.f035MelindaIds.some(idB => idB === idA))) {
      debugData(`Record A f035 ${JSON.stringify(a.f035MelindaIds)} matches record B f035 ${JSON.stringify(b.f035MelindaIds)}`);
      return 1;
    }
    debug(`No matching Melinda-IDs.`);
    return 0;
  }
};

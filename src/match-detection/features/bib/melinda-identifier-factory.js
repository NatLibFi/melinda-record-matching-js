/* eslint-disable no-extra-parens */
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
      return [];
    }

    return {isMelindaRecord, f001, f035MelindaIds};

    function getMelindaIds(record) {
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
    }

    function toMelindaIds({subfields}) {
      const melindaIdRegExp = /^(?<prefix>\(FI-MELINDA\)|FCC)(?<id>\d{9})$/u;

      return subfields
        .filter(sub => ['a', 'z'].includes(sub.code))
        .filter(sub => melindaIdRegExp.test(sub.value))
        .map(({value}) => value.replace(melindaIdRegExp, '$<id>'));

    }
  }

  function compare(a, b) {

    if (a.isMelindaRecord && b.isMelindaRecord && a.f001 === b.f001) {
      return 1;
    }

    if (a.isMelindaRecord && b.f035MelindaIds.some(id => id === a.f001)) {
      return 1;
    }

    if (b.isMelindaRecord && a.f035MelindaIds.some(id => id === b.f001)) {
      return 1;
    }

    if (a.f035MelindaIds.some(idA => b.f035MelindaIds.some(idB => idB === idA))) {
      return 1;
    }

    return 0;

  }
};

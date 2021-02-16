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

// 003+001 FI-MELINDA <melinda-id>
// 035 $a (FI-MELINDA)<melinda-id>
// 035 $z (FI-MELINDA)<melinda-id>
// 035 $a FCC<melinda-id>
// 035 $z FCC<melinda-id>
// melinda-id = 001234567

export default () => {
  return {extract, compare};

  // record.getFields('245', [{code: 'a', value: 'foo'}]);

  // eslint-disable-next-line max-statements
  function extract(record) {

    const isMelindaRecord = record.get('003').some(f003 => f003.value === 'FI-MELINDA');
    const [f001] = record.get('001').map(field => field.value);

    /*
    const f035MelindaIds = [
      ...record.getFields('035', [{code: 'a', value: /^\(FI-MELINDA\)\d{9}$/u}]).map(field => clearPrefixFiMelinda(field)),
      ...record.getFields('035', [{code: 'z', value: /^\(FI-MELINDA\)\d{9}$/u}]).map(field => clearPrefixFiMelinda(field)),
      ...record.getFields('035', [{code: 'a', value: /^FCC\d{9}$/u}]).map(field => clearPrefixFcc(field)),
      ...record.getFields('035', [{code: 'z', value: /^FCC\d{9}$/u}]).map(field => clearPrefixFcc(field))
    ];
*/
    // eslint-disable-next-line no-unused-vars
    const f035s = record.getFields('035');
    const f035Subfields = f035s.map(field => field.subfields.filter(subfield => subfield.code === 'a'));
    //  const f035MelindaIds = record.getFields('035', [{code: 'a', value: /^\(FI-MELINDA\)\d{9}$/u}]);
    const f035MelindaIds = record.getFields('035').map(field => field.subfields);


    // eslint-disable-next-line no-console
    console.log(`Fields: ${JSON.stringify(f035s)}`);

    // eslint-disable-next-line no-console
    console.log(`Subfields: ${JSON.stringify(f035Subfields)}`);


    // eslint-disable-next-line no-console
    console.log(`Ids: ${JSON.stringify(f035MelindaIds)}`);

    if (
      isMelindaRecord === undefined &&
      f001 === undefined &&
      f035MelindaIds.length < 1) {
      return [];
    }

    return {isMelindaRecord, f001, f035MelindaIds};

    // eslint-disable-next-line no-unused-vars
    function clearPrefixFiMelinda(field) {
      return field.subfields.filter(subfield => (subfield.code === 'a' && (/^\(FI-MELINDA\)/u).test(subfield.value)) || (subfield.code === 'z' && (/^\(FI-MELINDA\)/u).test(subfield.value)))
        .map(subfield => subfield.value.replace('(FI-MELINDA)', ''));
    }
    // eslint-disable-next-line no-unused-vars
    function clearPrefixFcc(field) {
      return field.subfields.filter(subfield => (subfield.code === 'a' && (/^FCC/u).test(subfield.value)) || (subfield.code === 'z' && (/^FCC/u).test(subfield.value)))
        .map(subfield => subfield.value.replace('FCC', ''));
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

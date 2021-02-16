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

export default ({sourceValue, subfieldCodes}) => {
  return {extract, compare};

  function extract(record) {
    const [field] = record.getFields('SID', [{code: 'b', value: sourceValue}]);

    // Note: This extracts feature only from first SID-field that has $b matching to source value.
    // Records should have only one SID per source.

    if (field) {
      return field.subfields
        .filter(({code}) => subfieldCodes.includes(code));
    }

    return [];
  }

  function compare(a, b) {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    if (a[0].value === b[0].value) {
      return 1;
    }

    if (a[0].value !== b[0].value) {
      return -1;
    }

    return 0;
  }
};

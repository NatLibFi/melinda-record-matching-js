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

export default () => ({
  name: 'Language',
  extract: record => {
    const value008 = get008Value();
    const values041 = get041Values();

    if (value008 && values041.length > 0) {
      const correspondingValue = values041.find(v => v === value008);
      return correspondingValue ? [correspondingValue] : [];
    }

    return value008 ? [value008] : [values041[0]];

    function get008Value() {
      const value = record.get(/^008$/u)?.[0]?.value || [];
      const code = value.slice(35, 38);
      return code === '|||' ? undefined : code;
    }

    function get041Values() {
      return record.get(/^041$/u)
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'a')
        .map(({value}) => value);
    }
  },
  compare: (a, b) => {
    if (a[0] === b[0]) {
      return 0.1;
    }

    return a[0] === 'und' || b[0] === 'und' ? 0.0 : -1.0;
  }
});

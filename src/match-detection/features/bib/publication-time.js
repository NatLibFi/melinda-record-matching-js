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

import {testStringOrNumber} from '../../../matching-utils';

// We should also get copyright time and copyright/publication times from 26x
// We could also enable matching of records which have consequent publication years

export default () => ({
  name: 'Publication time',
  extract: ({record}) => {
    const value = record.get(/^008$/u)?.[0]?.value || undefined;
    return testStringOrNumber(value) ? [String(value).slice(7, 11)] : [];
  },
  compare: (a, b) => a[0] === b[0] ? 0.1 : -1.0
});

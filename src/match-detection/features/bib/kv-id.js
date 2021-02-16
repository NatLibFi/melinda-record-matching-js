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

import createInterface from './source-identifier-factory';


// SID $c <source-id> $b <source-id-source>
// SID $c 123456 $b helka
// SID $c VER2722372 $b FI-KV

/* {
    "tag": "SID",
    "subfields": [
        { "code": "c", "value": "VER2722372" },
        { "code": "b", "value": "FI-KV" }
    ],
    "ind1": " ",
    "ind2": " "
}
*/

export default () => {
  const {extract, compare} = createInterface({sourceValue: 'FI-KV', subfieldCodes: ['c']});
  return {extract, compare, name: 'kv-id'};
};

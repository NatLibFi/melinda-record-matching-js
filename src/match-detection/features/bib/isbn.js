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

import createInterface from './standard-identifier-factory';
import {parse as isbnParse} from 'isbn3';
import createDebugLogger from 'debug';

const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:ISBN`);
const debugData = debug.extend('data');

export default () => {
  const IDENTIFIER_NAME = 'ISBN';

  function validatorAndNormalizer(string) {
    const isbnParseResult = isbnParse(string);
    debugData(`isbnParseResult: ${JSON.stringify(isbnParseResult)}`);
    if (isbnParseResult === null) {
      debug(`Not parseable ISBN, just removing hyphens`);
      return {valid: false, value: string.replace(/-/ug, '')};
    }
    debug(`Parseable ISBN, normalizing to ISBN-13`);
    return {valid: true, value: isbnParseResult.isbn13};
  }

  const {extract, compare} = createInterface({identifier: IDENTIFIER_NAME, pattern: /^020$/u, subfieldCodes: ['a', 'z'], validIdentifierSubfieldCodes: ['a'], invalidIdentifierSubfieldCodes: ['z'], validatorAndNormalizer});
  return {extract, compare, name: IDENTIFIER_NAME};
};


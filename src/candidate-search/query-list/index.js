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

import * as bib from './bib';

export const searchTypes = {
  bib: {
    standardIdentifiers: 'bibStandardIdentifiers',
    hostComponents: 'bibHostComponents',
    title: 'bibTitle', // title ( + first author + first publisher if needed)
    titleAuthor: 'bibTitleAuthor', // title + first author (or first publisher if no author)
    titleAuthorYear: 'bibTitleAuthorYear', // title + first author (or first publisher if no author), publishing year
    titleAuthorYearAlternates: 'bibTitleAuthorYearAlternates', // title + first author (or first publisher if no author), publishing year
    melindaId: 'bibMelindaIds',
    sourceIds: 'bibSourceIds'
    //DEVELOP: bibContent: 'bibContent'
  }
};

export default (record, searchSpec) => {
  const extractors = {...bib};

  return searchSpec
    .map(generateQueryExtractor)
    .map(cb => cb(record))
    .flat();

  function generateQueryExtractor(type) {
    if (extractors[type]) {
      return extractors[type];
    }

    throw new Error(`Unknown search type: ${type}`);
  }
};

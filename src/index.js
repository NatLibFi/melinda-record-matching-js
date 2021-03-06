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
import createSearchInterface, * as candidateSearch from './candidate-search';
import createDetectionInterface, * as matchDetection from './match-detection';

export {candidateSearch, matchDetection};

export default ({detection: detectionOptions, search: searchOptions, maxMatches = 1, maxCandidates = 25}) => {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:index');
  const detect = createDetectionInterface(detectionOptions);

  return record => {
    const search = createSearchInterface({...searchOptions, record});
    return iterate();

    // eslint-disable-next-line max-statements
    async function iterate(initialState = {}, matches = [], candidateCount = 0) {
      const {records, ...state} = await search(initialState);

      if (records.length > 0 || state.queriesLeft > 0) {
        debug(`Checking ${records.length} candidates for matches`);

        const matchResult = iterateRecords(records);

        if (matchResult) {
          const newMatches = matches.concat(matchResult);

          if (newMatches.length === maxMatches) {
            return newMatches;
          }

          return maxCandidatesRetrieved() ? newMatches : iterate(state, newMatches, candidateCount + records.length);
        }

        return maxCandidatesRetrieved() ? matches : iterate(state, matches, candidateCount + records.length);
      }

      debug(`No (more) candidate records to check, matches: ${matches.length}`);
      return matches;

      function maxCandidatesRetrieved() {
        if (candidateCount + records.length > maxCandidates) {
          debug(`Stopped searching because maximum number of candidates have been retrieved`);
          return true;
        }
      }

      function iterateRecords(records) {
        const [candidate] = records;

        if (candidate) {
          const {record: candidateRecord, id: candidateId} = candidate;
          const {match, probability} = detect(record, candidateRecord);

          if (match) {
            return {
              probability,
              candidate: {
                id: candidateId,
                record: candidateRecord
              }
            };
          }

          return iterateRecords(records.slice(1));
        }
      }
    }
  };
};

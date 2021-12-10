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
      debug(`Current state: ${JSON.stringify(state)}`);

      if (records.length > 0 || state.queriesLeft > 0) {
        debug(`Checking ${records.length} candidates for matches`);

        const matchResult = iterateRecords({records, maxMatches, matches});
        const newMatches = matches.concat(matchResult);

        if (maxMatchesFound(newMatches, maxMatches)) {
          return newMatches;
        }

        return maxCandidatesRetrieved() ? newMatches : iterate(state, newMatches, candidateCount + records.length);
      }

      debug(`No (more) candidate records to check, matches: ${matches.length}`);
      return matches;

      function maxCandidatesRetrieved() {
        if (candidateCount + records.length > maxCandidates) {
          debug(`Stopped searching because maximum number of candidates have been retrieved`);
          return true;
        }
      }

      // eslint-disable-next-line max-statements
      function iterateRecords({records, maxMatches, matches, recordMatches = []}) {
        const [candidate] = records;

        if (candidate && candidateNotInMatches(matches, candidate)) {
          const {record: candidateRecord, id: candidateId} = candidate;
          debug(`Running matchDetection for record ${candidateId}`);

          const {match, probability} = detect(record, candidateRecord);

          if (match) {
            const newMatch = {
              probability,
              candidate: {
                id: candidateId,
                record: candidateRecord
              }
            };
            const newRecordMatches = recordMatches.concat(newMatch);

            if (maxMatchesFound(matches.concat(newRecordMatches), maxMatches)) {
              return newRecordMatches;
            }

            return iterateRecords({records: records.slice(1), maxMatches, matches, newRecordMatches});
          }
          return iterateRecords({records: records.slice(1), maxMatches, matches, recordMatches});
        }

        debug('Record set done');
        return recordMatches;
      }

      function maxMatchesFound(matches, maxMatches) {
        if (matches.length >= maxMatches) {
          debug(`Stopping: maxMatches (${maxMatches}) found.`);
          return true;
        }
      }

      function candidateNotInMatches(matches, candidate) {
        // This does not do any checking at the moment
        debug(`Check here whether record ${candidate.id} is already included in ${matches.length} matches`);
        return true;
      }

    }
  };
};

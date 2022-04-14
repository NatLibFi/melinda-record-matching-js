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

import createDebugLogger from 'debug';
import createSearchInterface, * as candidateSearch from './candidate-search';
import createDetectionInterface, * as matchDetection from './match-detection';
//import inspect from 'util';

export {candidateSearch, matchDetection};

export default ({detection: detectionOptions, search: searchOptions, maxMatches = 1, maxCandidates = 25, returnStrategy = false, returnQuery = false, returnNonMatches = false, returnFailures = false}) => {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:index');
  const debugData = debug.extend('data');

  debugData(`DetectionOptions: ${JSON.stringify(detectionOptions)}`);
  debugData(`SearchOptions: ${JSON.stringify(searchOptions)}`);
  debugData(`MaxMatches: ${JSON.stringify(maxMatches)}`);
  debugData(`MaxCandidates: ${JSON.stringify(maxCandidates)}`);
  debugData(`ReturnStrategy: ${JSON.stringify(returnStrategy)}`);
  debugData(`ReturnQuery: ${JSON.stringify(returnQuery)}`);
  debugData(`ReturnNonMatches: ${JSON.stringify(returnNonMatches)}`);
  debugData(`ReturnFailures: ${JSON.stringify(returnFailures)}`);


  const detect = createDetectionInterface(detectionOptions, returnStrategy);

  return record => {
    const search = createSearchInterface({...searchOptions, record, maxCandidates});
    return iterate({});

    // candidateCount : amount of candidate records retrived from SRU for matching, NOT including current record set
    // matches : candidates that have been detected as matches by current matcher job
    // nonMatches : candidates that have been detected as non-matches by current matcher job (only if returnNonMatches is 'true')
    // duplicateCount : amount of candidate records that were retrieved from the SRU but not handled further because they were already found in the matches/nonMatches

    // state.totalRecords : amount of candidate records available to the current query (undefined, if there was no queries left)
    // state.query : current query (undefined if there was no queries left)
    // state.searchCounter : sequence for current search for current query (undefined, if there we no queries left)
    // state.queryCandidateCounter: amount of candidate records retrieved from SRU for matching for current query, including the current record set (undefined if there were no queries left)
    // state.queriesLeft : amount of queries left
    // state.queryCounter : sequence for current query
    // state.maxedQueries : queries that resulted in more than serverMaxResults hits

    async function iterate({initialState = {}, matches = [], candidateCount = 0, nonMatches = [], duplicateCount = 0, nonMatchCount = 0, conversionFailures = [], matchErrors = []}) {
      debugData(`Starting next matcher iteration.`);
      const {records, failures, ...state} = await search(initialState);

      debugData(`Current state: ${JSON.stringify(state)}, matches: ${matches.length}, candidateCount: ${candidateCount}, nonMatches: ${nonMatches.length}, nonMatchCount: ${nonMatchCount}, conversionFailures: ${conversionFailures}, matchErrors: ${matchErrors.length}`);
      const recordSetSize = records.length;
      const failureSetSize = failures.length;
      const newCandidateCount = candidateCount + recordSetSize + failureSetSize;

      const newConversionFailures = conversionFailures.concat(failures);
      debugData(`Failures: ${failures.length}, ConversionFailures: ${conversionFailures.length}, NewConversionFailures: ${newConversionFailures.length}`);

      if (recordSetSize > 0) {
        return handleRecordSet();
      }

      if (state.queriesLeft > 0) {
        debug(`Empty record set ${state.searchCounter} for ${state.query}, but there are ${state.queriesLeft} queries left`);
        return iterate({initialState: state, matches, candidateCount: newCandidateCount, nonMatches, nonMatchCount, duplicateCount, conversionFailures: newConversionFailures, matchErrors});
      }

      debug(`No (more) candidate records to check, no more queries left, matches: ${matches.length}`);
      return returnResult({matches, state, stopReason: '', nonMatches, nonMatchCount, candidateCount: newCandidateCount, duplicateCount, conversionFailures: newConversionFailures, matchErrors});

      function handleRecordSet() {
        debug(`Checking record set of ${recordSetSize} candidate records for possible matches, found by ${state.searchCounter} search for ${state.query}`);

        const matchResult = iterateRecords({records, recordSetSize, maxMatches, matches, nonMatches, nonMatchCount});

        const newDuplicateCount = duplicateCount + matchResult.duplicateCount;
        const newNonMatchCount = nonMatchCount + matchResult.nonMatchCount;
        const {newMatches, newNonMatches, newMatchErrors} = handleMatchResult(matchResult, matches, nonMatches, matchErrors);

        if (maxMatchesFound({matches: newMatches, maxMatches})) {
          return returnResult({matches: newMatches, state, stopReason: 'maxMatches', nonMatches: newNonMatches, duplicateCount: newDuplicateCount, candidateCount: newCandidateCount, nonMatchCount: newNonMatchCount, conversionFailures: newConversionFailures, matchErrors: newMatchErrors});
        }

        if (maxCandidatesRetrieved(newCandidateCount, maxCandidates)) {
          return returnResult({matches: newMatches, state, stopReason: 'maxCandidates', nonMatches: newNonMatches, duplicateCount: newDuplicateCount, candidateCount: newCandidateCount, nonMatchCount: newNonMatchCount, conversionFailures: newConversionFailures, matchErrors: newMatchErrors});
        }

        return iterate({initialState: state, matches: newMatches, candidateCount: newCandidateCount, nonMatches: newNonMatches, duplicateCount: newDuplicateCount, nonMatchCount: newNonMatchCount, conversionFailures: newConversionFailures, matchErrors: newMatchErrors});
      }

      function handleMatchResult(matchResult, matches, nonMatches, matchErrors) {
        debugData(`- Amount of new matches from record set: ${matchResult.matches.length}`);
        // eslint-disable-next-line functional/no-conditional-statement
        if (returnNonMatches) {
          debugData(`- Amount of new nonMatches from record set: ${matchResult.nonMatches.length}`);
        }

        const newMatches = matches.concat(returnQuery ? addQuery(matchResult.matches) : matchResult.matches);
        const newNonMatches = returnNonMatches ? nonMatches.concat(returnQuery ? addQuery(matchResult.nonMatches) : matchResult.nonMatches) : [];
        const newMatchErrors = matchErrors.concat(matchResult.matchErrors);

        debugData(`- Total amount of matches: ${newMatches.length}`);
        // eslint-disable-next-line functional/no-conditional-statement
        if (returnNonMatches) {
          debugData(`- Total amount of nonMatches: ${newNonMatches.length}`);
        }

        debugData(`MatchResult: ${JSON.stringify(matchResult)}`);
        debugData(`Old matchErrors: ${JSON.stringify(matchErrors)}, matchErrors from matchResult: ${JSON.stringify(matchResult.matchErrors)}, New matchErrors: ${JSON.stringify(newMatchErrors)}`);

        debugData(`- Total amount of matchErrors: ${newMatchErrors.length}`);

        return {newMatches, newNonMatches, newMatchErrors};
      }

      function addQuery(matches) {
        debugData(`Adding query ${state.query} to matches`);
        return matches.map((match) => ({...match, matchQuery: state.query}));
      }

      function maxCandidatesRetrieved(candidateCount, maxCandidates) {
        debugData(`Total amount of candidate records retrieved: ${newCandidateCount} (max: ${maxCandidates})`);
        if (maxCandidates && candidateCount >= maxCandidates) {
          debug(`Stopped matching because maximum number of candidate records ${candidateCount} / ${maxCandidates} have been retrieved`);
          return true;
        }
      }
    }

    // matches : array of matching candidate records
    // nonMatches : array of nonMatching candidate records (if returnNonMatches option is true, otherwise empty array)
    // - candidate.id
    // - candidate.record
    // - probability
    // - strategy (if returnStrategy option is true)
    // - treshold (if returnStrategy option is true)
    // - matchQuery (if returnQuery option is true)
    // failures: array of conversionFailures from candidate-search and matchErrors from matchDetection in error format {status, payload: {message, id}} if returnFailures is true

    // we could have here also returnRecords/returnMatchRecords/returnNonMatchRecord options that could be turned false for not to return actual record data

    // matchStatus.status: boolean, true if matcher retrieved and handled all found candidate records, false if it did not
    // matchStatus.stopReason: string ('maxMatches','maxCandidates','maxedQueries','conversionFailures', empty string/undefined), reason for stopping retrieving or handling the candidate records
    // - only one stopReason is returned (if there would be several possible stopReasons, stopReason is picked in the above order)
    // - currently stopReason can be non-empty also in cases where status is true, if matcher hit the stop reason when handling the last available candidate record

    function returnResult({matches, state, stopReason, nonMatches, duplicateCount, candidateCount, nonMatchCount, conversionFailures, matchErrors}) {
      const conversionFailureCount = conversionFailures.length;
      const matchErrorCount = matchErrors.length;
      checkCounts({matches, nonMatches, candidateCount, duplicateCount, nonMatchCount, conversionFailureCount, matchErrorCount});
      const matchStatus = getMatchState(state, stopReason, conversionFailureCount, matchErrorCount);
      // add nonMatches to result only if returnNonMatches is 'true', otherwise nonMatches have not been gathered
      const matchesResult = returnNonMatches ? {matches, matchStatus, nonMatches} : {matches, matchStatus};
      const failures = [...conversionFailures, ...matchErrors];
      const result = returnFailures ? {...matchesResult, conversionFailures: failures} : matchesResult;
      debugData(`ReturnFailures ${returnFailures}`);
      debugData(`${JSON.stringify(result)}`);
      return result;

      // note that in cases where the matching has been stopped because of maxMatches checkCounts won't (in most cases) match

      function checkCounts({matches, nonMatches, candidateCount, duplicateCount, nonMatchCount, conversionFailureCount, matchErrorCount}) {
        const matchCount = matches.length;
        debugData(`Return nonMatches: ${returnNonMatches}`);
        const chosenNonMatchCount = returnNonMatches ? nonMatches.length : nonMatchCount;
        const totalHandled = matchCount + chosenNonMatchCount + duplicateCount;
        debug(`candidateCount: ${candidateCount}, matches: ${matchCount}, nonMatches: ${chosenNonMatchCount}, duplicateCount: ${duplicateCount}, conversionFailureCount: ${conversionFailureCount}, matchErrorCount: ${matchErrorCount}`);
        debug(`We got result for ${totalHandled} / ${candidateCount} retrieved candidates`);
        if (totalHandled !== candidateCount) {
          debug(`WARNING: Missing results for ${candidateCount - totalHandled} candidates`);
          return;
        }
        return;
      }

      // eslint-disable-next-line max-statements
      function getMatchState(state, stopReason, conversionFailuresCount, matchErrorCount) {
        debugData(`${JSON.stringify(state)}`);
        debug(`We had ${conversionFailuresCount} retrieved candidates that could not be converted.`);
        debug(`We had ${matchErrorCount} retrieved candidates that errored in matchDetection.`);
        debug(`Queries left ${state.queriesLeft}, Searches for current query left: ${state.resultSetOffset && state.resultSetOffset <= state.totalRecords}, non-retrieved records: ${state.totalRecords - state.queryCandidateCounter}, maxedQueries (${state.maxedQueries.length}): ${state.maxedQueries}`);

        debugData(`StopReason: <${stopReason}>`);

        const searchesLeft = state.resultSetOffset && state.resultSetOffset <= state.totalRecords;
        const nonRetrieved = searchesLeft ? state.totalRecords - state.queryCandidateCounter : 0;
        debugData(`nonRetrieved: ${nonRetrieved}`);

        // matchStatus.stopReason: string ('maxMatches','maxCandidates','maxedQueries','conversionFailures', empty string/undefined), reason for stopping retrieving or handling the candidate records
        // 'maxMatches' and 'maxCandidates' are in stopReason, 'maxedQueries', 'conversionFailures' and 'matchErrors' are created here

        if (state.queriesLeft > 0 || nonRetrieved > 0 || state.maxedQueries.length > 0 || conversionFailureCount > 0 || matchErrorCount > 0) {
          const maxedQueriesStopReason = state.maxedQueries.length > 0 ? 'maxedQueries' : undefined;
          const conversionFailuresStopReason = conversionFailureCount > 0 ? 'conversionFailures' : undefined;
          const matchErrorsStopReason = matchErrorCount > 0 ? 'matchErrors' : undefined;
          const newStopReason = stopReason === '' || stopReason === undefined ? maxedQueriesStopReason || conversionFailuresStopReason || matchErrorsStopReason : stopReason;
          debugData(`MaxedQueriesStopReason: <${maxedQueriesStopReason}>`);
          debugData(`ConversionFailureStopReason <${conversionFailuresStopReason}>`);
          debugData(`MatchErrorsStopReason <${matchErrorsStopReason}>`);
          debugData(`NewStopReason: <${newStopReason}>`);
          debug(`Match status: false`);
          return {status: false, stopReason: newStopReason};
        }

        debug(`Match status: true`);
        return {status: true, stopReason};
      }
    }

    // NOTES:
    // - we could optimize by creating the featureSet for the incoming record once and using it for all database/candidateRecords
    // - if creating the featureSet for the incoming record fails we have an unprocessable entity
    // - if creating the featureSet for a candidate record fails we could skip that candidate - but list the case as a detectionFailure, same as conversionFailures

    // eslint-disable-next-line max-statements
    function iterateRecords({records, recordSetSize, maxMatches, matches = [], nonMatches = [], recordMatches = [], recordNonMatches = [], recordCount = 0, recordDuplicateCount = 0, recordNonMatchCount = 0, recordMatchErrors = []}) {

      // recordSetSize : total amount of records in the current record set
      // recordCount : amount of records from the current record set that have been handled
      // maxMatches : setting for maximum amount found by current matcher job before the matcher job is stopped
      // recordDuplicateCount : amount of records from the current record set that are already included in matches/nonMatches results
      // recordNonMatchCount: amount of records from the current record set that are nonMatches (only is returnNonMatches setting is false)

      // records : non-handled records in the current record set
      // matches : found matches in the current matcher job
      // recordMatches : found matches in the current record set
      // recordNonMatches : found nonMatches in the current record set (only if returnNonMatches setting is true)
      // recordMatchErrors: errored matchDetection in the current record set

      const [candidate] = records;
      const newRecordCount = candidate ? recordCount + 1 : recordCount;

      // The matcher uses same matchDetection strategy for candidates from all candidate-searches -> matchDetection result for the same candidate is always same
      // Exceptions would happen if the candidate would have been updated in the database between candidate searches
      // Note that if returnNonMatches is false, matcher won't remember candidates that didn't match, so they will be matched again everytime they are retrieved by
      // different candidate search queries. Same candidate search query won't have duplicate records.

      /* We could optimize and detect all retrieved candidates at once
      const candidateRecords = records.map(record => record.record);
      const recordsIsArray = Array.isArray(candidateRecords);
      debug(`records is an array: ${recordsIsArray}`);
      const result = detect(record, candidateRecords);
      debug(`${JSON.stringify(result)}`);
      */

      if (candidate) {

        // eslint-disable-next-line functional/no-conditional-statement
        if (candidateNotInMatches(matches.concat(nonMatches), candidate)) {
          const {record: candidateRecord, id: candidateId} = candidate;
          try {
            debug(`Running matchDetection for record ${candidateId} (${newRecordCount}/${recordSetSize})`);
            // we should handle errors from detection somehow - ie. cases where either record or candidateRecord errors
            const detectionResult = detect(record, candidateRecord);

            return handleDetectionResult(detectionResult, candidateId, candidateRecord);
          } catch (error) {
            debug(`MatchDetection errored: database record ${candidateId}: ${error}`);

            const matchError = {status: 422, payload: {message: `Matching errored for database record ${candidateId}. ${error.message}.`, id: candidateId}};
            const newRecordMatchErrors = recordMatchErrors.concat(matchError);
            return iterateRecords({records: records.slice(1), recordSetSize, maxMatches, matches, recordMatches, recordCount: newRecordCount, recordNonMatches, recordDuplicateCount, recordNonMatchCount, recordMatchErrors: newRecordMatchErrors});
          }
        }

        return iterateRecords({records: records.slice(1), recordSetSize, maxMatches, matches, recordMatches, recordCount: newRecordCount, recordNonMatches, recordDuplicateCount: recordDuplicateCount + 1, recordNonMatchCount, recordMatchErrors});
      }

      debug(`No more candidates, record set (${recordCount}/${recordSetSize}) done, ${recordMatches.length} matches found, ${recordDuplicateCount} candidates already handled, ${returnNonMatches ? `${recordNonMatches.length}` : `${recordNonMatchCount}`} nonMatches found.`);
      return {matches: recordMatches, nonMatches: returnNonMatches ? recordNonMatches : [], duplicateCount: recordDuplicateCount, nonMatchCount: recordNonMatchCount, matchErrors: recordMatchErrors};

      function handleDetectionResult(detectionResult, candidateId, candidateRecord) {
        debugData(`MatchDetection results for ${candidateId} (${newRecordCount}/${recordSetSize}): ${JSON.stringify(detectionResult)}`);

        if (detectionResult.match || returnNonMatches) {
          debug(`${detectionResult.match ? `Record ${candidateId} (${newRecordCount}/${recordSetSize}) is a match!` : `Record ${candidateId} (${newRecordCount}/${recordSetSize}) is NOT a match!`}`);
          debugData(`Strategy: ${JSON.stringify(detectionResult.strategy)}, Treshold: ${JSON.stringify(detectionResult.treshold)}`);

          const matchResult = {
            probability: detectionResult.probability,
            candidate: {
              id: candidateId,
              record: candidateRecord
            }
          };
          const strategyResult = {
            strategy: detectionResult.strategy,
            treshold: detectionResult.treshold
          };
          const newMatch = returnStrategy ? {...matchResult, ...strategyResult} : {...matchResult};

          debugData(`${JSON.stringify(newMatch)}`);

          return handleRecordMatch(detectionResult.match, newMatch);
        }

        const newRecordNonMatchCount = recordNonMatchCount + 1;
        debugData(`- Total nonMatches after this detection: ${newRecordNonMatchCount}`);

        return iterateRecords({records: records.slice(1), recordSetSize, maxMatches, matches, recordMatches, recordCount: newRecordCount, recordNonMatches, recordDuplicateCount, recordNonMatchCount: newRecordNonMatchCount, recordMatchErrors});
      }

      function handleRecordMatch(isMatch, newMatch) {
        const newRecordMatches = isMatch ? recordMatches.concat(newMatch) : recordMatches;
        const newRecordNonMatches = isMatch ? recordNonMatches : recordNonMatches.concat(newMatch);
        const newRecordNonMatchCount = isMatch ? recordNonMatchCount : recordNonMatchCount + 1;

        debugData(`- Total matches after this detection: ${matches.concat(newRecordMatches).length} (max: ${maxMatches})`);

        // eslint-disable-next-line functional/no-conditional-statement
        if (returnNonMatches) {
          debugData(`- Total nonMatches after this detection: ${nonMatches.concat(newRecordNonMatches).length}`);
        }
        debugData(`- Total nonMatchCount after this detection: ${recordNonMatchCount}`);

        if (maxMatchesFound({matches: matches.concat(newRecordMatches), maxMatches})) {
          debug(`MaxMatches (${maxMatches}) reached, handled candidates in record set: ${newRecordCount} non-handled candidates in record set ${recordSetSize - newRecordCount}`);
          return {matches: newRecordMatches, nonMatches: returnNonMatches ? newRecordNonMatches : [], duplicateCount: recordDuplicateCount, nonMatchCount: newRecordNonMatchCount, matchErrors: recordMatchErrors};
        }

        return iterateRecords({records: records.slice(1), recordSetSize, maxMatches, matches, recordMatches: newRecordMatches, recordCount: newRecordCount, recordNonMatches: returnNonMatches ? newRecordNonMatches : [], duplicateCount: recordDuplicateCount, recordNonMatchCount: newRecordNonMatchCount, matchErrors: recordMatchErrors});
      }

      function candidateNotInMatches(matches, candidate) {
        debug(`Checking that record ${candidate.id} is not already included in ${matches.length} matches/nonMatches`);
        const newCandidateId = candidate.id;
        debugData(`newCandidateId: ${newCandidateId}`);
        const result = matches.find(({candidate}) => candidate.id === newCandidateId);
        debugData(`Result: ${result}`);
        if (result) {
          debug(`${candidate.id} was already handled.`);
          return false;
        }
        debug(`${candidate.id} not found in matches/nonMatches`);
        return true;
      }
    }

    function maxMatchesFound({matches, maxMatches}) {
      if (maxMatches && matches.length >= maxMatches) {
        debug(`Stopping recordSet iteration: maxMatches (${maxMatches}) for matcher job found.`);
        return true;
      }
    }
  };
};

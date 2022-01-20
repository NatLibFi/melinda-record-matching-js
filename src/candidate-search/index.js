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
import createClient, {SruSearchError} from '@natlibfi/sru-client';
import {MarcRecord} from '@natlibfi/marc-record';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import generateQueryList from './query-list';

export {searchTypes} from './query-list';

export class CandidateSearchError extends Error {}

// serverMaxResults : maximum size of total search result available from the server, defaults to Aleph's 20000

// eslint-disable-next-line max-statements
export default ({record, searchSpec, url, maxCandidates, maxRecordsPerRequest = 50, serverMaxResult = 20000}) => {
  MarcRecord.setValidationOptions({subfieldValues: false});

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search');
  const debugData = debug.extend('data');

  debugData(`SearchSpec: ${JSON.stringify(searchSpec)}`);
  debugData(`Url: ${url}`);
  debugData(`MaxRecordsPerRequest ${maxRecordsPerRequest}`);
  debugData(`ServerMaxResult: ${serverMaxResult}`);
  debugData(`MaxCandidates: ${maxCandidates}`);

  // Do not retrieve more candidates than defined in maxCandidates
  const adjustedMaxRecordsPerRequest = maxRecordsPerRequest >= maxCandidates ? maxCandidates : maxRecordsPerRequest;

  const inputRecordId = getRecordId(record);
  const queryList = generateQueryList(record, searchSpec);
  const client = createClient({
    url,
    maxRecordsPerRequest: adjustedMaxRecordsPerRequest,
    version: '2.0',
    retrieveAll: false
  });

  debug(`Searching matches for ${inputRecordId}`);
  debug(`Generated queryList ${JSON.stringify(queryList)}`);
  if (queryList.length === 0) { // eslint-disable-line functional/no-conditional-statement
    throw new CandidateSearchError(`Generated query list contains no queries`);
  }

  // state.totalRecords : amount of candidate records available to the current query (undefined, if there was no queries left)
  // state.query : current query (undefined if there was no queries left)
  // state.searchCounter : sequence for current search for current query (undefined, if there we no queries left)
  // state.queryCandidateCounter: amount of candidate records retrieved from SRU for matching for current query, including the current record set (undefined if there were no queries left)
  // state.queriesLeft : amount of queries left
  // state.queryCounter : sequence for current query
  // state.maxedQueries : queries that resulted in more than serverMaxResults hits


  // eslint-disable-next-line max-statements
  return async ({queryOffset = 0, resultSetOffset = 1, totalRecords = 0, searchCounter = 0, queryCandidateCounter = 0, queryCounter = 0, maxedQueries = []}) => {
    const query = queryList[queryOffset];

    if (query) {
      const {records, nextOffset, total} = await retrieveRecords();

      // If resultSetOffset === 1 this is the first search for the current query
      const newTotalRecords = resultSetOffset === 1 ? total : totalRecords;
      const newQueryCounter = resultSetOffset === 1 ? queryCounter + 1 : queryCounter;
      const newSearchCounter = resultSetOffset === 1 ? 1 : searchCounter + 1;
      const newQueryCandidateCounter = resultSetOffset === 1 ? records.length : queryCandidateCounter + records.length;

      const maxedQuery = resultSetOffset === 1 ? checkMaxedQuery(query, total, serverMaxResult) : undefined;
      const newMaxedQueries = maxedQuery ? maxedQueries.concat(maxedQuery) : maxedQueries;

      if (typeof nextOffset === 'number') {
        debug(`Next search will be for query ${queryOffset} ${query}, starting from record ${nextOffset}`);
        return {records, queryOffset, resultSetOffset: nextOffset, queriesLeft: queryList.length - (queryOffset + 1), totalRecords: newTotalRecords, query, searchCounter: newSearchCounter, queryCandidateCounter: newQueryCandidateCounter, queryCounter: newQueryCounter, maxedQueries: newMaxedQueries};
      }
      debug(`Query ${queryOffset} ${query} done.`);
      debug(`There are (${queryList.length - (queryOffset + 1)} queries left)`);
      return {records, queryOffset: queryOffset + 1, queriesLeft: queryList.length - (queryOffset + 1), totalRecords: newTotalRecords, query, searchCounter: newSearchCounter, queryCandidateCounter: newQueryCandidateCounter, queryCounter: newQueryCounter, maxedQueries: newMaxedQueries};
    }

    debug(`All ${queryList.length} queries done, there's no query for ${queryOffset}`);
    return {records: [], queriesLeft: 0, queryCounter, maxedQueries};

    function retrieveRecords() {
      return new Promise((resolve, reject) => {
        const promises = [];
        // eslint-disable-next-line functional/no-let
        let totalRecords = 0;

        debug(`Searching for candidates with query: ${query} (Offset ${resultSetOffset})`);

        client.searchRetrieve(query, {startRecord: resultSetOffset})
          .on('error', err => {
            // eslint-disable-next-line functional/no-conditional-statement
            if (err instanceof SruSearchError) {
              debug(`SRU SruSearchError for query: ${query}: ${err}`);
              reject(new CandidateSearchError(`SRU SruSearchError for query: ${query}: ${err}`));
            }
            debug(`SRU error for query: ${query}: ${err}`);
            reject(new CandidateSearchError(`SRU error for query: ${query}: ${err}`));
          })
          .on('total', total => {
            debug(`Got total: ${total}`);
            totalRecords += total;
          })
          .on('end', async nextOffset => {
            try {
              const records = await Promise.all(promises);
              const filtered = records.filter(r => r);

              debug(`Found ${filtered.length} candidates`);

              resolve({nextOffset, records: filtered, total: totalRecords});
            } catch (err) {
              reject(err);
            }
          })
          .on('record', foundRecord => {
            promises.push(handleRecord()); // eslint-disable-line functional/immutable-data

            async function handleRecord() {
              try {
                const foundRecordMarc = await MARCXML.from(foundRecord, {subfieldValues: false});
                const foundRecordId = getRecordId(foundRecordMarc);

                // This does not work and might cause problems:
                // Record *should* match itself AND in REST the input record is given id 000000001 always
                debug(`Checking record id's - this does not work ${inputRecordId} vs ${foundRecordId}`);
                if (inputRecordId === foundRecordId) {
                  debug(`Input and candidate are the same record per 001. Discarding candidate`);
                  return;
                }

                return {record: foundRecordMarc, id: foundRecordId};
              } catch (err) {
                throw new Error(`Failed converting record: ${err}, record: ${foundRecord}`);
              }
            }
          });
      });
    }
  };

  function checkMaxedQuery(query, total, serverMaxResult) {
    // eslint-disable-next-line functional/no-conditional-statement
    if (total >= serverMaxResult) {
      debug(`WARNING: Query ${query} resulted in ${total} hits which meets the serverMaxResult (${serverMaxResult}) `);
      return query;
    }
  }


  function getRecordId(record) {
    const [field] = record.get(/^001$/u);
    return field ? field.value : '';
  }
};

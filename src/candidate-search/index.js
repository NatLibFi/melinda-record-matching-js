import createDebugLogger from 'debug';
import createClient, {SruSearchError} from '@natlibfi/sru-client';
import {MarcRecord} from '@natlibfi/marc-record';

import generateQueryList from './query-list/index.js';
import chooseQueries from './choose-queries.js';

export {searchTypes} from './query-list/index.js';

export class CandidateSearchError extends Error { }

// serverMaxResults : maximum size of total search result available from the server, defaults to Aleph's 20000

export default async ({record, searchSpec, url, maxCandidates, maxRecordsPerRequest = 50, serverMaxResult = 20000}) => {
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

  const client = createClient({
    url,
    maxRecordsPerRequest: adjustedMaxRecordsPerRequest,
    version: '2.0',
    retrieveAll: false,
    metadataFormat: 'marcJson'
  });

  const inputRecordId = getRecordId(record);
  const queryListResult = await generateQueryList(record, searchSpec, client);
  const queryList = queryListResult[0]?.queryList ? queryListResult[0].queryList : queryListResult;
  const queryListType = queryListResult[0]?.queryListType ? queryListResult[0].queryListType : undefined;

  // if generateQueryList errored we should throw 422
  if (queryList.length === 0) {
    debug(`Empty list`);
    throw new CandidateSearchError(`Generated query list contains no queries`);
  }
  if (queryListType && queryListType !== 'alternates') {
    debug(`Unknown queryListType`);
    throw new CandidateSearchError(`Generated query list has invalid type`);
  }

  debug(`Searching matches for ${inputRecordId}`);
  const chosenQueryList = await filterQueryList({queryList, queryListType});
  debug(`Chosen queries: ${JSON.stringify(chosenQueryList)}`);

  async function filterQueryList({queryList, queryListType, maxCandidates}) {
    debug(`Generated queryList (type: ${queryListType}) ${JSON.stringify(queryList)}`);

    if (queryListType === 'alternates' && queryList.length > 1) {
      const queryListResult = await chooseQueries({url, queryList, queryListType, maxCandidates});
      debug(`queryListResult: ${JSON.stringify(queryListResult)}`);
      return queryListResult.map(elem => elem.query);
    }
    return queryList;
  }
  // state.totalRecords : amount of candidate records available to the current query (undefined, if there was no queries left)
  // state.query : current query (undefined if there was no queries left)
  // state.searchCounter : sequence for current search for current query (undefined, if there we no queries left)
  // state.queryCandidateCounter: amount of candidates (records+failures) retrieved from SRU for matching for current query, including the current record+failure set (undefined if there were no queries left)
  // state.queriesLeft : amount of queries left
  // state.queryCounter : sequence for current query
  // state.maxedQueries : queries that resulted in more than serverMaxResults hits

  return {search};

  // eslint-disable-next-line max-statements
  async function search({queryOffset = 0, resultSetOffset = 1, totalRecords = 0, searchCounter = 0, queryCandidateCounter = 0, queryCounter = 0, maxedQueries = []}) {
    const query = chosenQueryList[queryOffset];
    debug(`Running query ${JSON.stringify(query)} (${queryOffset})`);

    if (query) {
      const {records, nextOffset, total} = await retrieveRecords(client, query, resultSetOffset);

      // If resultSetOffset === 1 this is the first search for the current query
      debugData(`ResultSetOffset: ${resultSetOffset}`);
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
  }

  function checkMaxedQuery(query, total, serverMaxResult) {
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

export function retrieveRecords(client, query, resultSetOffset) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:retrieveRecords');
  // eslint-disable-next-line no-unused-vars
  const debugData = debug.extend('data');

  return new Promise((resolve, reject) => {
    const records = [];
    let totalRecords = 0;

    debug(`Searching for candidates with query: ${query} (Offset ${resultSetOffset})`);

    client.searchRetrieve(query, {startRecord: resultSetOffset})
      .on('error', err => {
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
      .on('end', nextOffset => {
        try {
          debug(`Found ${records.length} records`);

          resolve({nextOffset, records, total: totalRecords});
        } catch (err) {
          debug(`Error caught on END`);
          reject(err);
        }
      })
      .on('record', record => {
        const [field] = record.get(/^001$/u);
        debug(field);
        const id = field.value ? field.value : '';
        records.push({record, id});
      });
  });
}

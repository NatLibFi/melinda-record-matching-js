import createDebugLogger from 'debug';
import createClient, {SruSearchError} from '@natlibfi/sru-client';

export class CandidateSearchError extends Error {}

export default async function ({url, queryList, queryListType, maxCandidates = 50}) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:choose-queries');
  const debugData = debug.extend('data');
  const debugDev = debug.extend('dev');

  debugData(`Url: ${url}`);
  debugData(`QueryList: ${queryList}`);
  debugData(`queryListType: ${queryListType}`);

  const client = createClient({
    url,
    maxRecordsPerRequest: 0,
    version: '2.0',
    retrieveAll: false
  });

  debugDev(`QueryList (type: ${queryListType}) ${JSON.stringify(queryList)}`);
  try {
    const {queriesWithTotals} = await getQueryTotals({queryList, queryOffset: 0, queriesWithTotals: []});
    debugDev(`QueryResult: ${JSON.stringify(queriesWithTotals)}`);
    const filteredQueryResult = filterQueryResult({queriesWithTotals, maxCandidates});
    debugDev(`filteredQueryResult: ${JSON.stringify(filteredQueryResult)}`);
    return filteredQueryResult;
  } catch (err) {
    throw new CandidateSearchError(err);
  }

  async function getQueryTotals({queryList, queryOffset = 0, queriesWithTotals = []}) {

    const query = queryList[queryOffset];
    debug(`Running query ${JSON.stringify(query)} (${queryOffset}) for total`);

    if (query) {
      const {total} = await retrieveTotal();

      const newQueriesWithTotals = [...queriesWithTotals, {query, total}];
      debug(`Query ${queryOffset} ${query} done.`);
      debug(`There are (${queryList.length - (queryOffset + 1)} queries left)`);
      return getQueryTotals({queryList, queryOffset: queryOffset + 1, queriesWithTotals: newQueriesWithTotals});
    }

    debug(`All ${queryList.length} queries done, there's no query for ${queryOffset}`);
    return {queriesWithTotals};

    function retrieveTotal() {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line functional/no-let
        let totalRecords = 0;

        debug(`Searching total amount of candidates for query: ${query}`);

        client.searchRetrieve(query)
          .on('error', err => {
            // eslint-disable-next-line functional/no-conditional-statements
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
          .on('end', () => {
            try {
              resolve({total: totalRecords});
            } catch (err) {
              debug(`Error caught on END`);
              reject(err);
            }
          })
          .on('record', () => {
            debugDev(`RECORD: We should no get records here`);
          });
      });
    }
  }
  function filterQueryResult({queriesWithTotals, maxCandidates}) {
    debug(`Filtering queries (${queriesWithTotals.length}), maxCandidates: ${maxCandidates}`);
    debugData(`${JSON.stringify(queriesWithTotals)}`);
    // Drop queries where total result is 0 or greater than given maxCandidates
    const filteredQueryResult = queriesWithTotals.filter((queryWithTotal) => queryWithTotal.total !== 0 && queryWithTotal.total < maxCandidates);
    debugData(`${JSON.stringify(filteredQueryResult)}`);
    return filteredQueryResult;
  }

}

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
import createClient, {SruSearchError} from '@natlibfi/sru-client';
import {MarcRecord} from '@natlibfi/marc-record';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import generateQueryList from './query-list';

export {searchTypes} from './query-list';

export class CandidateSearchError extends Error {}

export default ({record, searchSpec, url, maxRecordsPerRequest = 50}) => {
  MarcRecord.setValidationOptions({subfieldValues: false});

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search');
  const inputRecordId = getRecordId(record);
  const queryList = generateQueryList(record, searchSpec);
  const client = createClient({
    url, maxRecordsPerRequest,
    version: '2.0',
    retrieveAll: false
  });

  debug(`Searching matches for ${inputRecordId}`);
  debug(`Generated queryList ${JSON.stringify(queryList)}`);
  if (queryList.length === 0) { // eslint-disable-line functional/no-conditional-statement
    throw new CandidateSearchError(`Generated query list contains no queries`);
  }

  // eslint-disable-next-line max-statements
  return async ({queryOffset = 0, resultSetOffset = 1}) => {
    const query = queryList[queryOffset];

    if (query) {
      const {records, nextOffset} = await retrieveRecords();

      if (typeof nextOffset === 'number') {
        debug(`Running next search for query ${queryOffset} ${query}`);
        return {records, queryOffset, resultSetOffset: nextOffset, queriesLeft: queryList.length - (queryOffset + 1)};
      }
      debug(`Query ${queryOffset} ${query} done, moving to next query. (${queryList.length - (queryOffset + 1)} queries left)`);
      return {records, queryOffset: queryOffset + 1, queriesLeft: queryList.length - (queryOffset + 1)};
    }

    debug(`All ${queryList.length} queries done, there's no query for ${queryOffset}`);
    return {records: []};

    function retrieveRecords() {
      return new Promise((resolve, reject) => {
        const promises = [];

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
          .on('end', async nextOffset => {
            try {
              const records = await Promise.all(promises);
              const filtered = records.filter(r => r);

              debug(`Found ${filtered.length} candidates`);

              resolve({nextOffset, records: filtered});
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
                debug(`Checking ${inputRecordId} vs ${foundRecordId}`);
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

  function getRecordId(record) {
    const [field] = record.get(/^001$/u);
    return field ? field.value : '';
  }
};

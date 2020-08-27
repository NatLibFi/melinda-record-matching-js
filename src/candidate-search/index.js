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
import createClient from '@natlibfi/sru-client';
import {MarcRecord} from '@natlibfi/marc-record';
import {MARCXML} from '@natlibfi/marc-record-serializers';
import generateQueryList from './query-list';

export {searchTypes} from './query-list';

export class CandidateSearchError extends Error {}

export default ({record, searchSpec, url, maxRecordsPerRequest = '50'}) => {
  MarcRecord.setValidationOptions({subfieldValues: false});

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search');
  const queryList = generateQueryList(record, searchSpec);
  const client = createClient({
    url, maxRecordsPerRequest,
    version: '2.0',
    retrieveAll: false
  });


  if (queryList.length === 0) { // eslint-disable-line functional/no-conditional-statement
    throw new CandidateSearchError(`Generated query list contains no queries`);
  }

  return async ({queryOffset = 0, resultSetOffset = 1}) => {
    const query = queryList[queryOffset];

    if (query) {
      const {records, nextOffset} = await retrieveRecords();

      if (typeof nextOffset === 'number') {
        return {records, queryOffset, resultSetOffset: nextOffset};
      }

      return {records, queryOffset: queryOffset + 1};
    }

    return {records: []};

    function retrieveRecords() {
      return new Promise((resolve, reject) => {
        const promises = [];

        debug(`Searching for candidates with query: ${query} (Offset ${resultSetOffset})`);

        client.searchRetrieve(query, {startRecord: resultSetOffset})
          .on('error', err => {
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
                const foundRecordMarc = await MARCXML.from(foundRecord);

                if (hasSameId(foundRecordMarc)) {
                  debug(`Input and candidate are the same record per 001. Discarding candidate`);
                  return;
                }

                return foundRecordMarc;
              } catch (err) {
                reject(new Error(`Failed converting record: ${err}, record: ${foundRecord}`));
              }


              function hasSameId(foundRecord) {
                const inputId = getId(record);
                const candidateId = getId(foundRecord);
                return inputId === candidateId;

                function getId(record) {
                  const [field] = record.get(/^001$/u);
                  return field?.value;
                }
              }
            }
          });
      });
    }
  };
};

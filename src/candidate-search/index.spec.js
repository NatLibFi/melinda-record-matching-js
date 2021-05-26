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

import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen-http-client';
import {MarcRecord} from '@natlibfi/marc-record';
import createSearchInterface, {CandidateSearchError} from '.';

describe('candidate-search', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'candidate-search', 'index'],
    recurse: false,
    fixura: {
      reader: READERS.JSON
    }
  });

  // eslint-disable-next-line max-statements
  async function callback({getFixture, factoryOptions, searchOptions, expectedFactoryError, expectedSearchError, enabled = true}) {
    const url = 'http://foo.bar';

    if (!enabled) {
      return;
    }

    if (expectedFactoryError) {
      if (expectedFactoryError.isCandidateSearchError) {
        expect(() => createSearchInterface({...formatFactoryOptions(), url})).to.throw(CandidateSearchError, new RegExp(expectedFactoryError, 'u'));
        return;
      }

      expect(() => createSearchInterface({...formatFactoryOptions(), url})).to.throw(new RegExp(expectedFactoryError, 'u'));
      return;
    }

    const search = createSearchInterface({...formatFactoryOptions(), url});
    await iterate({searchOptions});

    function formatFactoryOptions() {
      return {
        ...factoryOptions,
        maxRecordsPerRequest: 1,
        record: new MarcRecord(factoryOptions.record, {subfieldValues: false})
      };
    }

    // eslint-disable-next-line max-statements
    async function iterate({searchOptions, count = 1}) {
      const expectedResults = getFixture(`expectedResults${count}.json`);

      if (expectedSearchError) { // eslint-disable-line functional/no-conditional-statement
        try {
          await search(searchOptions);
          throw new Error('Expected an error');
        } catch (err) {
          expect(err).to.be.an('error');
          expect(err.message).to.match(new RegExp(expectedSearchError, 'u'));
          return;
        }
      }

      const results = await search(searchOptions);

      expect(formatResults(results)).to.eql(expectedResults);

      if (results.records.length > 0) {
        return iterate({
          searchOptions: resultsToOptions(results),
          count: count + 1
        });
      }

      function formatResults(results) {
        // console.log(results); //eslint-disable-line
        return {
          ...results,
          records: results.records.map(({record, id}) => ({id, record: record.toObject()}))
        };
      }

      function resultsToOptions(results) {
        return Object.entries(results)
          .filter(([k]) => k === 'records' === false) // If key is 'records' return false
          .reduce((acc, [k, v]) => ({...acc, [k]: v}), {});
      }
    }
  }
});

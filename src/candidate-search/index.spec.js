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

import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen-http-client';
import {MarcRecord} from '@natlibfi/marc-record';
import {Error as MatchingError} from '@natlibfi/melinda-commons';
import createSearchInterface, {CandidateSearchError} from '.';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:test');

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
  async function callback({getFixture, factoryOptions, searchOptions, expectedFactoryError = false, expectedSearchError = false, enabled = true}) {
    const url = 'http://foo.bar';

    if (!enabled) {
      return;
    }

    if (expectedFactoryError) {
      debug(`We're expecting an error`);
      if (expectedFactoryError.isCandidateSearchError) {
        try {
          const result = createSearchInterface({...formatFactoryOptions(), url});
          debug(result);
        } catch (err) {
          expect(err).to.equal(new CandidateSearchError(expectedFactoryError));
        }
        return;
      }

      try {
        const result = createSearchInterface({...formatFactoryOptions(), url});
        debug(result);
      } catch (err) {
        expect(err).to.equal(new Error(expectedFactoryError));
      }
      return;
    }

    const {search} = await createSearchInterface({...formatFactoryOptions(), url});
    // eslint-disable-next-line no-console
    console.log(search);
    await iterate({searchOptions, expectedSearchError});

    function formatFactoryOptions() {
      debug(`Using factoryOptions: ${JSON.stringify(factoryOptions)}`);
      return {
        ...factoryOptions,
        maxRecordsPerRequest: factoryOptions.maxRecordsPerRequest || 1,
        maxServerResults: factoryOptions.maxServerResults || undefined,
        record: new MarcRecord(factoryOptions.record, {subfieldValues: false})
      };
    }

    async function iterate({searchOptions, expectedSearchError, expectedErrorStatus, count = 1}) {
      const expectedResults = getFixture(`expectedResults${count}.json`);

      if (expectedSearchError) { // eslint-disable-line functional/no-conditional-statements
        try {
          await search(searchOptions);
          throw new Error('Expected an error');
        } catch (err) {
          debug(`Got an error: ${err}`);
          expect(err).to.be.an('error');
          const errorMessage = err instanceof MatchingError ? err.payload.message : err.message;
          const errorStatus = err instanceof MatchingError ? err.status : undefined;
          debug(`errorMessage: ${errorMessage}, errorStatus: ${errorStatus}`);
          expect(errorMessage).to.match(new RegExp(expectedSearchError, 'u'));

          if (expectedErrorStatus) {
            expect(errorStatus).to.be(expectedErrorStatus);
            return;
          }
          return;
        }
      }

      // eslint-disable-next-line functional/no-conditional-statements
      if (!expectedSearchError) {
        const results = await search(searchOptions);
        expect(formatResults(results)).to.eql(expectedResults);
      }

      function formatResults(results) {
        debug(results);
        return {
          ...results,
          records: results.records.map(({record, id}) => ({id, record: record.toObject()}))
        };
      }

    }
  }
});

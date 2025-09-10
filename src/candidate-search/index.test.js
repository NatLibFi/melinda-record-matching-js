import assert from 'node:assert';
import {describe} from 'node:test';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen-http-client';
import {MarcRecord} from '@natlibfi/marc-record';
import {Error as MatchingError} from '@natlibfi/melinda-commons';
import createSearchInterface, {CandidateSearchError} from './index.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:test');

describe('candidate-search', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'candidate-search', 'index'],
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
          const result = await createSearchInterface({...formatFactoryOptions(), url});
          debug(result);
        } catch (err) {
          assert.equal(err instanceof CandidateSearchError, true);
          assert.match(err.message, new RegExp(expectedFactoryError.message));
        } finally {
          return;
        }
      }

      try {
        const result = await createSearchInterface({...formatFactoryOptions(), url});
        debug(result);
      } catch (err) {
        assert.equal(err instanceof Error, true);
        assert.match(err.message, new RegExp(expectedFactoryError.message));
      } finally {
        return;
      }
    }

    const {search} = await createSearchInterface({...formatFactoryOptions(), url});
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

      if (expectedSearchError) {
        try {
          await search(searchOptions);
          throw new Error('Expected an error');
        } catch (err) {
          debug(`Got an error: ${err}`);
          assert(err instanceof Error);
          const errorMessage = err instanceof MatchingError ? err.payload.message : err.message;
          const errorStatus = err instanceof MatchingError ? err.status : undefined;
          debug(`errorMessage: ${errorMessage}, errorStatus: ${errorStatus}`);
          assert.match(errorMessage, new RegExp(expectedSearchError, 'u'));

          if (expectedErrorStatus) {
            assert.equal(errorStatus, expectedErrorStatus);
            return;
          }
          return;
        }
      }

      if (!expectedSearchError) {
        const results = await search(searchOptions);
        assert.deepStrictEqual(formatResults(results), expectedResults);
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

import assert from 'node:assert';
import {describe} from 'node:test';
import createDebugLogger from 'debug';
import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
import {MarcRecord} from '@natlibfi/marc-record';
import * as generators from './bib.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibHostComponents:test');
const debugData = debug.extend('data');

describe('candidate-search/query-list/bib/', () => {
  generateTests({
    path: [import.meta.dirname, '..', '..', '..', 'test-fixtures', 'candidate-search', 'query-list', 'bib'],
    useMetadataFile: true,
    fixura: {
      reader: READERS.JSON
    },
    callback: ({type, inputRecord, expectedQuery, expectedQueryListType, enabled = true}) => {
      const generate = generators[type];
      const record = new MarcRecord(inputRecord, {subfieldValues: false});

      if (!enabled) {
        return;
      }

      const result = generate(record);
      debugData(`Result: ${JSON.stringify(result)}`);

      if (result.queryListType) {
        assert.deepStrictEqual(result.queryList, expectedQuery);
        assert.equal(result.queryListType, expectedQueryListType);
        return;
      }
      assert.deepStrictEqual(result, expectedQuery);
    }
  });
});

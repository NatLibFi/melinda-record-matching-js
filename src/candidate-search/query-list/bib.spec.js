import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import * as generators from './bib';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibHostComponents:test');
const debugData = debug.extend('data');

describe('candidate-search/query-list/bib/', () => {
  generateTests({
    path: [__dirname, '..', '..', '..', 'test-fixtures', 'candidate-search', 'query-list', 'bib'],
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
        expect(result.queryList).to.eql(expectedQuery);
        expect(result.queryListType).to.eql(expectedQueryListType);
        return;
      }
      expect(result).to.eql(expectedQuery);
    }
  });
});

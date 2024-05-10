
import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import * as features from './features';
import createDetectionInterface from '.';
import {inspect} from 'util';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:test');
const debugData = debug.extend('data');

describe('match-detection', () => {
  generateTests({
    path: [__dirname, '..', '..', 'test-fixtures', 'match-detection', 'index'],
    useMetadataFile: true,
    recurse: false,
    fixura: {
      reader: READERS.JSON
    },
    callback: ({getFixture, options, expectedResults, array, enabled = true}) => {

      if (!enabled) {
        debug(`*** DISABLED TEST! ***`);
        return;
      }

      const detect = createDetectionInterface(formatOptions());
      const recordA = new MarcRecord(getFixture('recordA.json'), {subfieldValues: false});
      debugData(inspect(recordA));

      debug(`Our recordB is an array of records: ${array}`);
      const recordB = array
        ? getFixture('recordB.json').map(recordJson => new MarcRecord(recordJson, {subfieldValues: false}))
        : new MarcRecord(getFixture('recordB.json'), {subfieldValues: false});
      debugData(inspect(recordB));

      const results = detect({recordA, recordB});
      debugData(`${JSON.stringify(results)}`);

      expect(results).to.eql(expectedResults);

      function formatOptions() {
        const contextFeatures = features[options.strategy.type];

        return {
          ...options,
          strategy: options.strategy.features.map(v => contextFeatures[v]())
        };
      }
    }
  });
});


import assert from 'node:assert';
import {describe} from 'node:test';
import test from 'node:test';
import createDebugLogger from 'debug';
import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
import {MarcRecord} from '@natlibfi/marc-record';
import * as features from '../../../../src/match-detection/features/bib/index.js';


const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib:test');
const debugData = debug.extend('data');


describe('match-detection/features/bib/', () => {
  generateTests({
    path: [import.meta.dirname, '..', '..', '..', '..', 'test-fixtures', 'match-detection', 'features', 'bib'],
    useMetadataFile: true,
    fixura: {
      reader: READERS.JSON
    },

    callback: ({feature, options, type, ...expectations}) => {
      debug(`Testing: ${feature} ${type}`);

      if (type === 'extract') {
        const {expectedFeatures, inputRecord} = expectations;
        const record = new MarcRecord(inputRecord, {subfieldValues: false});
        debugData(`Record: ${record}`);
        const {extract} = features[feature](options);

        assert.deepStrictEqual(extract({record}), expectedFeatures);
        return;
      }

      if (type === 'compare') {
        const {featuresA, featuresB, expectedPoints} = expectations;
        const {compare} = features[feature](options);

        assert.equal(Math.round(compare(featuresA, featuresB) *100)/100, expectedPoints);
        return;
      }

      throw new Error(`Invalid type ${type}`);
    }
  });

  describe('issn factory positiveWeight option guard', () => {
    test('valid values construct without throwing', () => {
      assert.doesNotThrow(() => features.issn());
      assert.doesNotThrow(() => features.issn({}));
      assert.doesNotThrow(() => features.issn({positiveWeight: undefined}));
      assert.doesNotThrow(() => features.issn({positiveWeight: 0}));
      assert.doesNotThrow(() => features.issn({positiveWeight: 0.75}));
    });

    test('invalid values throw a descriptive error', () => {
      const invalidValues = ['0.75', NaN, Infinity, -Infinity, -0.1, null, true, {}];
      for (const value of invalidValues) {
        assert.throws(
          () => features.issn({positiveWeight: value}),
          /issn: positiveWeight must be a finite number >= 0/,
          `expected factory to throw for positiveWeight ${String(value)}`
        );
      }
    });
  });
});

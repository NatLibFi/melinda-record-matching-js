
import generateTests from '@natlibfi/fixugen';
import {READERS} from '@natlibfi/fixura';
import {expect} from 'chai';
import {MarcRecord} from '@natlibfi/marc-record';
import * as features from '.';
import createDebugLogger from 'debug';


const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib:test');
const debugData = debug.extend('data');


describe('match-detection/features/bib/', () => {
  generateTests({
    path: [__dirname, '..', '..', '..', '..', 'test-fixtures', 'match-detection', 'features', 'bib'],
    useMetadataFile: true,
    fixura: {
      reader: READERS.JSON
    },

    callback: ({enabled = true, feature, options, type, ...expectations}) => {

      if (!enabled) {
        return;
      }

      debug(`Testing: ${feature} ${type}`);

      if (type === 'extract') {
        const {expectedFeatures, inputRecord} = expectations;
        const record = new MarcRecord(inputRecord, {subfieldValues: false});
        debugData(`Record: ${record}`);
        const {extract} = features[feature](options);

        expect(extract({record})).to.eql(expectedFeatures);
        return;
      }

      if (type === 'compare') {
        const {featuresA, featuresB, expectedPoints} = expectations;
        const {compare} = features[feature](options);

        expect(compare(featuresA, featuresB)).to.equal(expectedPoints);
        return;
      }

      throw new Error(`Invalid type ${type}`);
    }
  });
});

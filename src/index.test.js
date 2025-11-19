import assert from 'node:assert';
import {describe} from 'node:test';
import createDebugLogger from 'debug';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen-http-client';
import {MarcRecord} from '@natlibfi/marc-record';
import createMatchInterface, {matchDetection} from './index.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:index:test');
const debugData = debug.extend('data');

describe('INDEX', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', 'test-fixtures', 'index'],
    recurse: false,
    fixura: {
      reader: READERS.JSON
    }
  });

  // eslint-disable-next-line max-statements
  async function callback({getFixture, options, expectedMatchStatus, expectedStopReason, expectedFailures, expectedCandidateCount}) {

    const record = new MarcRecord(getFixture('inputRecord.json'), {subfieldValues: false});
    const expectedMatches = getFixture('expectedMatches.json');
    const expectedNonMatches = getFixture('expectedNonMatches.json') || [];


    const match = createMatchInterface(formatOptions());
    const {matches, matchStatus, nonMatches, conversionFailures, candidateCount} = await match({record});
    debugData(`Matches: ${matches.length}, Status: ${matchStatus.status}/${matchStatus.stopReason}, NonMatches: ${nonMatches ? nonMatches.length : 'not returned'}, ConversionFailures: ${conversionFailures ? conversionFailures.length : 'not returned'}`);

    assert.equal(matchStatus.status, expectedMatchStatus);
    assert.equal(matchStatus.stopReason, expectedStopReason);
    assert.equal(candidateCount, expectedCandidateCount);

    const formattedMatchResult = formatRecordResults(matches);
    assert.deepStrictEqual(formattedMatchResult, expectedMatches);

    const formattedNonMatchResult = formatRecordResults(nonMatches);
    assert.deepStrictEqual(formattedNonMatchResult, expectedNonMatches);

    if (expectedFailures) {
      assert.deepStrictEqual(conversionFailures, expectedFailures);
    }

    function formatOptions() {
      const contextFeatures = matchDetection.features[options.detection.strategy.type];

      return {
        ...options,
        search: {
          ...options.search
        },
        detection: {
          ...options.detect,
          strategy: options.detection.strategy.features.map(v => contextFeatures[v]())
        }
      };
    }

    function formatRecordResults(matches) {
      if (matches) {
        debugData(JSON.stringify(matches));
        return matches.map((match) => ({
          ...match,
          candidate: formatCandidate(match.candidate)
        }));
      }
      return [];
    }

    // Format candidate to remove validationOptions from record
    function formatCandidate({id, record}) {
      const newId = id;
      const newRecord = record;
      return {
        id: newId,
        record: newRecord.toObject()
      };
    }
  }
});

import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen-http-client';
import {MarcRecord} from '@natlibfi/marc-record';
import createMatchInterface, {matchDetection} from '.';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:index:test');
const debugData = debug.extend('data');

describe('INDEX', () => {
  generateTests({
    callback,
    path: [__dirname, '..', 'test-fixtures', 'index'],
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

    expect(matchStatus.status).to.eql(expectedMatchStatus);
    expect(matchStatus.stopReason).to.eql(expectedStopReason);
    expect(candidateCount).to.eql(expectedCandidateCount);

    const formattedMatchResult = formatRecordResults(matches);
    expect(formattedMatchResult).to.eql(expectedMatches);

    const formattedNonMatchResult = formatRecordResults(nonMatches);
    expect(formattedNonMatchResult).to.eql(expectedNonMatches);

    // eslint-disable-next-line functional/no-conditional-statements
    if (expectedFailures) {
      expect(conversionFailures).to.eql(expectedFailures);
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

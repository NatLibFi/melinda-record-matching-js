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

  async function callback({getFixture, options, enabled = true, expectedMatchStatus, expectedStopReason, expectedFailures}) {

    if (!enabled) {
      debug(`Disabled test!`);
      return;
    }

    const record = new MarcRecord(getFixture('inputRecord.json'), {subfieldValues: false});
    const expectedMatches = getFixture('expectedMatches.json');
    const expectedNonMatches = getFixture('expectedNonMatches.json') || [];


    const match = createMatchInterface(formatOptions());
    const {matches, matchStatus, nonMatches, conversionFailures} = await match({record});
    debugData(`Matches: ${matches.length}, Status: ${matchStatus.status}/${matchStatus.stopReason}, NonMatches: ${nonMatches ? nonMatches.length : 'not returned'}, ConversionFailures: ${conversionFailures ? conversionFailures.length : 'not returned'}`);

    expect(matchStatus.status).to.eql(expectedMatchStatus);
    expect(matchStatus.stopReason).to.eql(expectedStopReason);

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

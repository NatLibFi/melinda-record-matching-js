/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Melinda record matching modules for Javascript
*
* Copyright (C) 2020 University Of Helsinki (The National Library Of Finland)
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

describe('INDEX', () => {
  generateTests({
    callback,
    path: [__dirname, '..', 'test-fixtures', 'index'],
    recurse: false,
    fixura: {
      reader: READERS.JSON
    }
  });

  async function callback({getFixture, options, enabled = true}) {

    if (!enabled) {
      return;
    }

    const record = new MarcRecord(getFixture('inputRecord.json'), {subfieldValues: false});
    const expectedMatches = getFixture('expectedMatches.json');

    const match = createMatchInterface(formatOptions());
    const matches = await match(record);

    expect(formatResults()).to.eql(expectedMatches);

    function formatOptions() {
      const contextFeatures = matchDetection.features[options.detection.strategy.type];

      return {
        ...options,
        search: {
          ...options.search,
          maxRecordsPerRequest: 1
        },
        detection: {
          ...options.detect,
          strategy: options.detection.strategy.features.map(v => contextFeatures[v]())
        },
        maxMatches: 2,
        maxCandidates: 1
      };
    }

    function formatResults() {
      return matches.map(({candidate, probability}) => ({
        probability,
        candidate: {
          id: candidate.id,
          record: candidate.record.toObject()
        }
      }));
    }
  }
});

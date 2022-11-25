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

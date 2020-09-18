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
import * as features from '.';

generateTests({
  path: [__dirname, '..', '..', '..', '..', 'test-fixtures', 'match-detection', 'features', 'bib'],
  useMetadataFile: true,
  fixura: {
    reader: READERS.JSON
  },
  callback: ({feature, options, type, ...expectations}) => {
    if (type === 'extract') {
      const {expectedFeatures, inputRecord} = expectations;
      const record = new MarcRecord(inputRecord, {subfieldValues: false});
      const {extract} = features[feature](options);

      expect(extract(record)).to.eql(expectedFeatures);
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

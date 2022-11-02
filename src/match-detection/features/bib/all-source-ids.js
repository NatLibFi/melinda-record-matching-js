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

import createDebugLogger from 'debug';
import {validateSidFieldSubfieldCounts, getSubfieldValues} from '../../../matching-utils';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:all-source-ids');
const debugData = debug.extend('data');

/*

SID-fields in Melinda have sf $c with local id and sf $b with a code for the local db:

 SID__ $c 123457 $b helka
 SID__ $c (ANDL100020)1077305 $b sata
 SID__ $c VER999999 $ FI-KV

allSourceIds matching feature is formatted as [{sourceDb: "helka", sourceId: "123457"}, {sourceDb: "sata", sourceId: "(ANDL100020)1077305"}, {sourceDb: "FI-KV", sourceId: "VER999999"}]
- no normalization / prefix deletions etc. in the feature

Note: All Melinda records that have a matching records in a local db do NOT have SID for that local records,
      existence of a SID field depends on how the record has been added to Melinda and how it has been handled
      afterwards. SIDs are also not reliably maintained. A record might or might not have a SID for a local db
      after the matching record is removed from the local db.

Records with mismatching local ids for matching local db are a strong mismatch.
Records with matching local ids for matching local db are a very good match.

*/

export default () => ({
  name: 'All source IDs',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    debug(`Creating match detection features for all local source id's for ${label}`);

    const fSids = record.get('SID');
    debugData(`SID-fields (${fSids.length}): ${JSON.stringify(fSids)}`);

    const sidFeatures = getSidFeatures(fSids);
    debugData(`SID-features (${sidFeatures.length}): ${JSON.stringify(sidFeatures)}`);

    return sidFeatures;

    function getSidFeatures(fSids) {
      debug(`Getting Sid strings from SID fields`);

      // Map SID fields to sidFeatures, filter out empty strings
      const sidFeatures = fSids.map(toSidFeature).filter(nonEmptySid => nonEmptySid);
      return sidFeatures;

      function toSidFeature(field) {
        debug(`Getting feature from a field`);

        return validateSidFieldSubfieldCounts(field) ? createSidFeature(field) : '';

        function createSidFeature(field) {
          debug(`Creating feature from a field`);
          const [sfC] = getSubfieldValues(field, 'c');
          const [sfB] = getSubfieldValues(field, 'b');

          debugData(`${JSON.stringify(sfC)} + ${JSON.stringify(sfB)}`);
          debugData(`sourceDb: ${sfB}, sourceId: ${sfC}`);
          return {'sourceDb': sfB, 'sourceId': sfC};
        }
      }

    }

  },
  compare: (a, b) => {

    debugData(`Comparing ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

    const matches = a.filter(sidA => b.some(sidB => sidA.sourceDb === sidB.sourceDb &&
            sidA.sourceId === sidB.sourceId));
    debugData(`Matches (${matches.length}): ${JSON.stringify(matches)}`);

    const mismatches = a.filter(sidA => b.some(sidB => sidA.sourceDb === sidB.sourceDb &&
      sidA.sourceId !== sidB.sourceId));
    debugData(`Mismatches (${mismatches.length}): ${JSON.stringify(mismatches)}`);

    // If there's at least one mismatching source ID from matching source db
    if (mismatches.length > 0) {
      return -1;
    }

    // If there's at least one matching source ID from matching source db
    if (matches.length > 0) {
      return 1;
    }

    // If there are no source IDs with matching sources
    return 0;

  }
});

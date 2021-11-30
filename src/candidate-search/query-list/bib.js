
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
import {toQueries} from '../candidate-search-utils';
import {getMelindaIdsF035, validateSidFieldSubfieldCounts, getSubfieldValues} from '../../matching-utils';


export function bibSourceIds(record) {

  /* Melinda's SRU-index melinda.sourceid includes source IDs from SID fields in Melinda records
     SID-fields in Melinda have sf $c with local id and sf $b with a code for the local db:

     SID__ $c 123457 $b helka
     SID__ $c (ANDL100020)1077305 $b sata
     SID__ $c VER999999 $ FI-KV
     SID__ $c /10024/508126 $ REPO_THESEUS

    In melinda.sourceid -index case is kept, sourceprefixes in brackets and hyphens are normalized away:
    Note: slashes are not normalized away, but a SRU-search-string including slashes needs to be quoted

    1234567helka
    1077305sata
    VER999999FIKV
    /10024/508126REPO_THESEUS

    Note: All Melinda records that have a matching records in a local db do NOT have SID for that local records,
          existence of a SID field depends on how the record has been added to Melinda and how it has been handled
          afterwards. SIDs are also not reliably maintained. A record might or might not have a SID for a local db
          after the matching record is removed from the local db.

   */


  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:source-ids');
  const debugData = debug.extend('data');
  //const debugInfo = debug.extend('info');

  debug(`Creating queries for sourceid's`);

  const fSids = record.get('SID');
  debugData(`SID-fields (${fSids.length}): ${JSON.stringify(fSids)}`);

  return fSids.length > 0 ? toSidQueries(fSids) : [];

  function toSidQueries(fSids) {
    debug(`Creating actual queries for sourceid's`);

    const sidStrings = getSidStrings(fSids);

    if (sidStrings.length < 1) {
      debug(`No identifiers found, no queries created.`);
      return [];
    }

    const sidQueries = toQueries(sidStrings, 'melinda.sourceid');

    return sidQueries;

    function getSidStrings(fSids) {
      debug(`Getting Sid strings from SID fields`);

      // Map SID fields to valid sidStrings, filter out empty strings
      const sidStrings = fSids.map(toSidString).filter(nonEmptySid => nonEmptySid);
      return sidStrings;

      function toSidString(field) {
        debug(`Getting string from a field`);

        return validateSidFieldSubfieldCounts(field) ? createSidString(field) : '';

        function createSidString(field) {
          debug(`Creating string from a field`);
          const [sfC] = getSubfieldValues(field, 'c');
          const [sfB] = getSubfieldValues(field, 'b');

          const cleanedSfC = removeSourcePrefix(normalizeSidSubfieldValue(sfC));
          const cleanedSfB = normalizeSidSubfieldValue(sfB);

          debugData(`${JSON.stringify(sfC)} + ${JSON.stringify(sfB)}`);
          return cleanedSfC.concat(cleanedSfB);
        }

        function removeSourcePrefix(subfieldValue) {
          const sourcePrefixRegex = (/^(?<sourcePrefix>\([A-Za-z0-9-]+\))(?<id>.+)$/u);
          const normalizedValue = subfieldValue.replace(sourcePrefixRegex, '$<id>');
          debugData(`Normalized ${subfieldValue} to ${normalizedValue}`);
          return normalizedValue;
        }

        function normalizeSidSubfieldValue(subfieldValue) {
          debugData(`Normalizing ${subfieldValue}`);
          const normalizeAwayRegex = (/[- ]/u);
          return subfieldValue.replace(normalizeAwayRegex, '');
        }

      }
    }
  }
}

export function bibMelindaIds(record) {
  // Melinda's SRU-index melinda.melindaid includes f001 controlnumbers and old Melinda-IDs from f035z's for all non-deleted Melinda-records

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibMelindaIds');
  const debugData = debug.extend('data');
  debug(`Creating queries for MelindaIds`);

  // Note: Melinda-ID's for search queries are created just from records f035a's and f035z's
  // Both (FI-MELINDA)- and FCC-prefixed forms are found
  // f001 controlnumber is not currently included, even if record's f003 is FI-MELINDA
  const melindaIds = getMelindaIdsF035(record);

  debugData(`Unique identifiers (${melindaIds.length}): ${JSON.stringify(melindaIds)}`);

  if (melindaIds.length < 1) {
    debug(`No identifiers found, no queries created.`);
    return [];
  }

  return toQueries(melindaIds, 'melinda.melindaid');
}


// bibHostComponents returns host id from the first subfield $w of first field f773, see test-fixtures 04 and 05
// bibHostComponents should search all 773 $ws for possible host id, but what should it do in case of multiple host ids?
export function bibHostComponents(record) {
  const id = getHostId();
  return id ? [`melinda.partsofhost=${id}`] : [];

  function getHostId() {
    const [field] = record.get(/^773$/u);

    if (field) {
      const {value} = field.subfields.find(({code}) => code === 'w') || {};

      if (value && (/^\(FI-MELINDA\)/u).test(value)) {
        return value.replace(/^\(FI-MELINDA\)/u, '');
      }

      if (value && (/^\(FIN01\)/u).test(value)) {
        return value.replace(/^\(FIN01\)/u, '');
      }

      return false;
    }
    return false;
  }
}

// SRU search dc.title with a search phrase starting with ^ maps currently in Melinda to
// (probably) to *headings* index TIT
// Headings index TIT drops articles etc. from the start of the title according to the filing indicator
// Currently filing indicator is not implemented - if the title starts with an article and the Melinda
// record is correctly catalogued using a filing indicator -> dc.title search won't match

export function bibTitle(record) {
  const title = getTitle();

  if (title) {
    const formatted = title
      .replace(/[^\w\s\p{Alphabetic}]/gu, '')
      // Clean up concurrent spaces from fe. subfield changes
      .replace(/ +/gu, ' ')
      .trim()
      .slice(0, 30)
      .trim();

    // Prevent too many matches by having a minimum length requirement
    return formatted.length >= 5 ? [`dc.title="^${formatted}*"`] : [];
  }

  return [];

  function getTitle() {
    const [field] = record.get(/^245$/u);

    if (field) {
      return field.subfields
        .filter(({code}) => ['a', 'b'].includes(code))
        .map(({value}) => value)
        // In Melinda's index subfield separators are indexed as ' '
        .join(' ');
    }
    return false;
  }
}

// eslint-disable-next-line max-statements
export function bibStandardIdentifiers(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibStandardIdentifiers');
  const debugData = debug.extend('data');
  debug(`Creating queries for standard identifiers`);

  const fields = record.get(/^(?<def>020|022|024)$/u);
  const identifiers = [].concat(...fields.map(toIdentifiers));
  const uniqueIdentifiers = [...new Set(identifiers)];

  debugData(`Standard identifier fields: ${JSON.stringify(fields)}`);
  debugData(`Identifiers (${identifiers.length}): ${JSON.stringify(identifiers)}`);
  debugData(`Unique identifiers (${uniqueIdentifiers.length}): ${JSON.stringify(uniqueIdentifiers)}`);

  if (uniqueIdentifiers.length < 1) {
    debug(`No identifiers found, no queries created.`);
    return [];
  }

  return toQueries(uniqueIdentifiers, 'dc.identifier');

  function toIdentifiers({tag, subfields}) {
    const issnIsbnReqExp = (/^[A-Za-z0-9-]+$/u);
    const otherIdReqExp = (/^[A-Za-z0-9-:]+$/u);

    if (tag === '022') {
      return subfields
        .filter(sub => ['a', 'z', 'y'].includes(sub.code) && issnIsbnReqExp.test(sub.value) && sub.value !== undefined)
        .map(({value}) => value);
    }

    if (tag === '020') {
      return subfields
        .filter(sub => ['a', 'z'].includes(sub.code) && issnIsbnReqExp.test(sub.value) && sub.value !== undefined)
        .map(({value}) => value);
    }

    return subfields
      .filter(sub => ['a', 'z'].includes(sub.code) && otherIdReqExp.test(sub.value) && sub.value !== undefined)
      .map(({value}) => value);
  }
}

/* eslint-disable max-statements */
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

import createDebugLogger from 'debug';
import {extractSubfieldsFromField, uniqueSubfields} from '../../../matching-utils';

// Note about validity of standardIdentifiers:
// We have three types of invalid standardIdentifiers:
// 1. Formally invalid standardIdentifiers (ie. typos either in the resource or the record)
// 2. Formally valid standardIdentifiers that are used in a wrong resource
// 3. Canceled standardIdentifiers

// Matcher could and should check that a standardIdentifier found in a subfield for a valid identifier is formally valid, and if it's not formally valid, handle it as an invalid standardIdentifier
// Formally valid standardIdentifiers found in subfield for invalid identifier cannot be handled as valid standardIdentifiers, because they can be a case of type 2) or 3) invalid standardIdentifiers
// We could also do a separate handling for formally valid an formally invalid standardIdentifiers

export default ({pattern, subfieldCodes, identifier, validIdentifierSubfieldCodes = ['a'], invalidIdentifierSubfieldCodes = ['z'], validatorAndNormalizer = undefined}) => {
  const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:${identifier}`);
  const debugData = debug.extend('data');

  return {extract, compare};

  function extract({record, recordExternal}) {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const fields = record.get(pattern);
    debugData(`${label}: ${fields.length} ${identifier}-fields `);

    // extractIdentifierSubfield normalizes hyphens away from the subfield values
    const identifiersFromFields = fields.map(field => extractSubfieldsFromField(field, subfieldCodes));
    debugData(`${label}: IDs from fields (${identifiersFromFields.length}): ${JSON.stringify(identifiersFromFields)}`);
    const allIdentifiers = identifiersFromFields.flat();
    debugData(`${label}: Flat IDs from fields (${allIdentifiers.length}): ${JSON.stringify(allIdentifiers)}`);

    const validatedAndNormalizedIdentifiers = validateAndNormalizeIdentifiers({identifierSubs: allIdentifiers, validatorAndNormalizer, validIdentifierSubfieldCodes, invalidIdentifierSubfieldCodes});

    const identifiers = uniqueSubfields(validatedAndNormalizedIdentifiers);

    debugData(`${label}: Unique IDs from fields (${identifiers.length}): ${JSON.stringify(identifiers)}`);
    return identifiers;

    function validateAndNormalizeIdentifiers({identifierSubs, validatorAndNormalizer, validIdentifierSubfieldCodes, invalidIdentifierSubfieldCodes}) {
      if (validatorAndNormalizer) {
        return identifierSubs.map((idSub) => validateAndNormalizeIdentifier({idSub, validatorAndNormalizer, validIdentifierSubfieldCodes, invalidIdentifierSubfieldCodes}));
      }
      return identifierSubs.map((idSub) => normalizeHyphens(idSub));
    }

    function validateAndNormalizeIdentifier({idSub, validatorAndNormalizer, validIdentifierSubfieldCodes, invalidIdentifierSubfieldCodes}) {
      const {valid, value} = validatorAndNormalizer(idSub.value);
      if (validIdentifierSubfieldCodes.includes(idSub.code) && valid === false) {
        const [code] = invalidIdentifierSubfieldCodes;
        return {code, value};
      }
      return {code: idSub.code, value};
    }

    function normalizeHyphens(idSub) {
      return {code: idSub.code, value: idSub.value.replace(/-/ug, '')};
    }


  }

  function compare(a, b) {
    debug(`Comparing A and B`);
    if (a.length === 0 || b.length === 0) {
      debugData(`No standardidentifiers (${identifier}) to compare`);
      return 0;
    }

    debugData(`A: ${JSON.stringify(a)}`);
    debugData(`B: ${JSON.stringify(b)}`);


    if (bothHaveValidIdentifiers()) {
      // Compare only valid identifiers, if both have valid idenfiers
      const {maxValues, possibleMatchValues, matchingValues} = getValueCount(true);
      if (matchingValues < 1) {
        debug(`Both have valid standardidentifiers (${identifier}), but none of these match.`);
        return -0.75;
      }
      debug(`Both have valid standardidentifiers (${identifier}), ${matchingValues}/${possibleMatchValues} valid identifiers match.`);
      // ignore non-matches if there is mismatching amount of values
      debug(`Possible matches: ${possibleMatchValues}/${maxValues}`);
      //we give some kind of penalty for mismatching amount of values instead of simple divide?
      const penaltyForMissing = 0.1 * (maxValues - possibleMatchValues);
      const penaltyForMisMatch = 0.2 * (possibleMatchValues - matchingValues);
      debug(`\t points: penaltyForMissing: ${penaltyForMissing}`);
      debug(`\t points: penaltyForMisMatch: ${penaltyForMisMatch}`);

      return 0.75 - penaltyForMisMatch - penaltyForMissing;
      //return matchingValues / possibleMatchValues * 0.75;
    }
    // If both do not have valid identifiers, compare all identifiers
    const {maxValues, matchingValues} = getValueCount();
    debug(`Both do NOT have valid standardidentifiers (${identifier}), ${matchingValues}/${maxValues} valid/invalid identifiers match.`);

    return matchingValues / maxValues * 0.2;

    function bothHaveValidIdentifiers() {
      const aValues = a.filter(({code}) => validIdentifierSubfieldCodes.includes(code));
      const bValues = a.filter(({code}) => validIdentifierSubfieldCodes.includes(code));
      debug(`A: ${aValues.length} valid ${identifier} identifiers`);
      debug(`B: ${bValues.length} valid ${identifier} identifiers`);
      return aValues.length > 0 && bValues.length > 0;
    }

    function getValueCount(validOnly = false) {
      const aValues = getIdentifiers(a, validOnly);
      const bValues = getIdentifiers(b, validOnly);

      const matchingValues = getMatchingValuesAmount(aValues, bValues);

      return {
        maxValues: aValues.length > bValues.length ? aValues.length : bValues.length,
        // possibleMatchingValues: amount of identifiers in set of less identifiers (we cannot more values than these)
        possibleMatchValues: aValues.length > bValues.length ? bValues.length : aValues.length,
        matchingValues
      };

      function getMatchingValuesAmount(aValues, bValues) {
        if (bValues.length > aValues.length) {
          return aValues.filter(aValue => bValues.some(bValue => aValue === bValue)).length;
        }
        if (aValues.length > bValues.length) {
          return bValues.filter(bValue => aValues.some(aValue => bValue === aValue)).length;
        }

        // If we have same amount of values, we'll check matches both ways, to avoid mixups in cases
        // there would be duplicate values
        const aToB = aValues.filter(aValue => bValues.some(bValue => aValue === bValue)).length;
        const bToA = bValues.filter(bValue => aValues.some(aValue => bValue === aValue)).length;

        return aToB < bToA ? aToB : bToA;
      }

      function getIdentifiers(values, validOnly) {
        if (validOnly) {
          return values
            .filter(({code}) => validIdentifierSubfieldCodes.includes(code))
            .map(({value}) => value);
        }

        return values.map(({value}) => value);
      }
    }
  }
};

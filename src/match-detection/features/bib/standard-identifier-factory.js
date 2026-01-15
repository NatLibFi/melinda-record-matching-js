/* eslint-disable max-statements */

import createDebugLogger from 'debug';
import {extractSubfieldsFromField, uniqueSubfields} from '../../../matching-utils.js';

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

    const SCORE = 0.75;

    debugData(`A: ${JSON.stringify(a)}`);
    debugData(`B: ${JSON.stringify(b)}`);

    const aValid = a.filter(sf => validIdentifierSubfieldCodes.includes(sf.code));
    const bValid = b.filter(sf => validIdentifierSubfieldCodes.includes(sf.code));

    if (aValid.some(asf => bValid.find(bsf => bsf.value === asf.value)) || bValid.some(bsf => aValid.find(asf => asf.value === bsf.value))) {
      return SCORE;
    }

    if (bothHaveValidIdentifiers()) {
      return -SCORE;
    }
    // Not sure what to do if two invalid identifiers match... (There might me some stuff that causes false positives for some identifier types)
    return 0.0;


      /*
      //we give some kind of penalty for mismatching amount of values instead of simple divide?
      const penaltyForMissing = 0.1 * (maxValues - possibleMatchValues);
      const penaltyForMisMatch = 0.2 * (possibleMatchValues - matchingValues);
      debug(`\t points: penaltyForMissing: ${penaltyForMissing}`);
      debug(`\t points: penaltyForMisMatch: ${penaltyForMisMatch}`);

      return 0.75 - penaltyForMisMatch - penaltyForMissing;
      //return matchingValues / possibleMatchValues * 0.75;
      */

    /*
    //// If both do not have valid identifiers, compare all identifiers
    //const {maxValues, matchingValues} = getValueCount();
    //debug(`Both do NOT have valid standardidentifiers (${identifier}), ${matchingValues}/${maxValues} valid/invalid identifiers match.`);

    //return matchingValues / maxValues * 0.2;
    */

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

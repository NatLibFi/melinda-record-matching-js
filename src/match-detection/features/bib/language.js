
import createDebugLogger from 'debug';
import clone from 'clone';

import {FixSami041, Remove041zxx} from '@natlibfi/marc-record-validators-melinda';

import {getMatchCounts} from '../../../matching-utils.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:language');
const debugData = debug.extend('data');

// NB! 2025-12-17: I changed the logic drastically. However, I tried to keep the scores as same as possible.
// 'extract' no longer extracts anything. Instead it clones the record, and does some preprocessing (using validators) instead.
// 'compare' had multiple changes
// - f041 ind1 differences ('0' vs '1') now result in a small penalty
// - Two sami languages related changes:
// -- validator adds a 'smi' subfield before a corresponding sma/sme/...subfield, if needed (national)
// -- 'smi' only vs 'smi'+'sma' does not cause penalty
// - 'mul' vs 'fin'+'swe' does not cause a penalty. However, 'mul' vs 'fin' alone triggers penalty.
// - 008/35-37 and f041$a/$d are calculated separately
// - a threshold is applied: return value is always between -1.0 and +0.1 (as it was before)
// - we try to handle 041 $2 ISO 639-2 and ISO 639-3 as well.
// - 'und' vs one other language does not cause a penalty in certain contexts. In other contexts it's treated as a normal "language code". (Tune/alleviate penalties later on.)

export default () => ({
  name: 'Language',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const clonedRecord = clone(record); // NB! This loses record.get()...

    FixSami041().fix(clonedRecord); // Handle 'smi' adding if needed
    Remove041zxx().fix(clonedRecord); // Remove 'zxx' from f041s

    // NB! Apply filters!
    // - Normalize language codes
    // - Normalize sami langage codes
    // - Remove 'zxx'
    return [{leader: clonedRecord.leader, fields: clonedRecord.fields}, label];
  },
  // eslint-disable-next-line max-statements
  compare: (aa, bb) => {
    const [a, aLabel] = aa;
    const [b, bLabel] = bb;
    debugData(`Comparing language ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

    const score008 = compare008();
    const score041 = compare041();
    return applyLimits(score008 + score041);

    function applyLimits(score) {
      if (score > 0.1) {
        return 0.1;
      }
      if (score < -1) {
        return -1.0;
      }
      return score;
    }

    function compare008() {
      const a008 = get008Value(a, aLabel);
      const b008 = get008Value(b, bLabel);
      // Something seriously wrong with 008:
      if (a008 === undefined || b008 === undefined) {
        return 0.0; // Punish for generic badness?
      }

      if (containsNoData(a008) || containsNoData(b008)){
        // Nothing to compare
        return 0.0;
      }

      if (a008 === b008) {
        return 0.05;
      }
      return -0.2;
    }





    function compare041() {
      const a041s = getFields041(a);
      const b041s = getFields041(b);
      if (a041s.length === 0 || b041s.length === 0) {
        return 0.0; // Should we punish these for badness?
      }
      if (a041s.length === 1 && b041s.length === 1) {
        if (getSourceOfLanguageCode(a041s[0]) === getSourceOfLanguageCode(b041s[0])) {
          const scoreInd1 = indicator1Penalty(a041s[0], b041s[0]);
          debug(`\t Indicator penalty: '${scoreInd1}'`);
          return scoreInd1 + compareLanguageCodeLists(getFieldsLanguageCodes(a041s[0]), getFieldsLanguageCodes(b041s[0]));
        }
        return -1.0;
      }

      return compareLanguageCodeLists(getLanguageCodesFrom041Fields(a), getLanguageCodesFrom041Fields(b));

      function getFields041(record) {
        if (!record.fields) {
          return [];
        }
        return record.fields.filter(f => f.tag === '041');
      }

    }

    function getSourceOfLanguageCode(field) {
      const sf2 = field.subfields.find(sf => sf.code === '2');
      if (!sf2) {
        return undefined;
      }
      // Normalize the two relevant language code names:
      if (sf2.value.match(/639.2/u)) {
        return 'ISO 639-2';
      }
      if (sf2.value.match(/639.3/u)) {
        return 'ISO 639-3';
      }
      return sf2.value; // We don't actually have anything else in Melinda though
    }

    function indicator1Penalty(aField, bField) {
      if (aField.ind1 === ' ' || bField.ind1 === ' '|| aField.ind1 === bField.ind1 ) {
        return 0.0;
      }
      debug(`\t Indicator penalty: '${aField.ind1}' vs '${bField.ind1}'`);
      return -0.1;
    }



    function containsNoData(languageCode) {
      return ['   ', '|||', 'und'].includes(languageCode);
    }

    function compareLanguageCodeLists(a, b) {
      if (a.length === 0 || b.length === 0) {
        debugData(`No language to compare`);
        return 0;
      }

      // If either one of the sets has only the generic 'smi', remove the specific sami languages codes from the other as well:
      const samiLanguageCodes = ['sma', 'sme', 'smj', 'smn', 'sms']; // NB! Don't put generic 'smi' here!

      if (a.includes('smi') && b.includes('smi')) {
        if (a.some(code => samiLanguageCodes.includes(code)) && !b.some(code => samiLanguageCodes.includes(code))) {
          return compareLanguageCodeLists(a.filter(val => !samiLanguageCodes.includes(val)), b); // recurse
        }
        if (b.some(code => samiLanguageCodes.includes(code)) && !a.some(code => samiLanguageCodes.includes(code))) {
          return compareLanguageCodeLists(a, b.filter(val => !samiLanguageCodes.includes(val))); // recurse
        }
      }




      if (a.length === b.length && a.every((element, index) => element === b[index])) {
        debugData(`All languages match`);
        return 0.1;
      }

      // Handle 'mul'. (Should we check whether the other array contains mul as well, probably not...)
      // (If 'mul' does not appear alone, then it is very iffy... )
      if (a.length === 1 && a[0] === 'mul' && b.length > 1) {
        return 0;
      }
      if (b.length === 1 && b[0] === 'mul' && a.length > 1) {
        return 0;
      }



      // Damage control:

      // Not using the generic solution here as 'und' can mean a lot
      const sharedValues = getSharedValues(a, b);
      const aOnly = a.filter(val => !sharedValues.includes(val));
      const bOnly = b.filter(val => !sharedValues.includes(val));
      const hasUnd = [...aOnly, ...bOnly].includes('und');

      if (sharedValues.length < 1) {
        console.info(`NV: ${sharedValues.join(", ")}`);
        if (aOnly.length === 1 && bOnly.length === 1 && hasUnd) {
          debug(`Both have languages, but none of these match. However, the benefit of doubt is given: '${aOnly[0]}' and '${bOnly[0]}' might mean the same}`);
          return 0;
        }
        debug(`Both have languages, but none of these match.`);
        return -1.0;
      }

      const {matchingValues, possibleMatchValues, maxValues} = getMatchCounts(a, b);


      debug(`Both have languages, ${matchingValues}/${possibleMatchValues} valid languages match.`);
      // ignore non-matches if there is mismatching amount of values
      debug(`Possible matches: ${possibleMatchValues}/${maxValues}`);
      // we give some kind of penalty for mismatching amount of values instead of simple divide?
      const missingCount = maxValues - possibleMatchValues;
      const misMatchCount = possibleMatchValues - matchingValues;
      debug(`\t missing: ${missingCount}`);
      debug(`\t mismatches: ${misMatchCount}`);

      const penaltyForMissing = 0.02 * (maxValues - possibleMatchValues);
      const penaltyForMisMatch = 0.05 * (possibleMatchValues - matchingValues);
      debug(`\t points: penaltyForMissing: ${penaltyForMissing}`);
      debug(`\t points: penaltyForMisMatch: ${penaltyForMisMatch}`);

      const points = Number(Number(0.1 - penaltyForMisMatch - penaltyForMissing).toFixed(2));
      debug(`Total points: ${points}`);

      return points;
    }
  }

});

function get008Value(record, label = 'record') {
  if (!record || !record.fields) {
    return;
  }
  const f008 = record.fields.find(f => f.tag === '008');
  if (!f008) {
    return undefined;
  }
  const value = f008.value || defaultValue;

  if (!value) {
    debugData(`${label}: Failed to extact 008/35-37 value from '${value}'`);
    return defaultValue;
  }

  const code = value.slice(35, 38);
  debugData(`${label}: 008 code: '${code}'`);
  return code;
}

// Check if a string is a possible, validly formed language code for a single language
// Currently accept also codes in capitals
function isLangCodeForALanguage(code, label = 'record', encoding = undefined) {
  if (!code) {
    return false;
  }

  if ([undefined, 'ISO 639-2', 'ISO-639-3'].includes(encoding) && code.length !== 3) {
    debugData(`${label}: Code ${code} is not correct length (3) for a language code.`);
    return false;
  }
  if (!encoding) {
    // 'mul' should be passed as 'mul' can match 'fin' + 'swe' etc.
    // 'zxx' should be removed by a validator
    // '^^^' is Aleph-specific corruption, not supporting it anymore
    if (code === '|||' || code === '   ' ) { // || code === '^^^' || code === 'mul' || code === 'zxx') {
      debugData(`${label}: Code ${code} is not code for a spesific language.`);
      return false;
    }
  }
  // Marc, ISO 639-2 and ISO 639-3 are all three-letters long. Not other language codes seen in Melinda:
  const langCodePattern = /^[a-z][a-z][a-z]$/ui;
  if (!langCodePattern.test(code)) {
    debugData(`${label}: Code ${code} is not valid as a language code`);
    return false;
  }
  return true;
}



function getLanguageCodesFrom041Fields(record) {
  // NB! We brutally don't check $2 (language code source) as marc's language codes is practically a subset of ISO 639-2,
  // and also ISO 639-2 and ISO 639-3 overlap to a degree. If we ever run into a trouble with some ISO 639-2 vs 639-3 mismatch, then we'll work it out.
  // Also we could write a validator that converts ISO 639-2 to marc if applicable and maybe even partial support for ISO-639-3.
  // Note that ISO 639-2-B values correspond with marc beteer that ISO 639-2-T. Eg. code for Chinese 'zho' should/code be normalized to 'chi'!
  const values = record.fields.filter(f => f.tag === '041').flatMap(f => getSingle041Values(f));
  /*
        // .filter(({ind2}) => ind2 === ' ')
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'a' || code === 'd')
        .filter(({value}) => value && isLangCodeForALanguage(value))
        .map(({value}) => value);
    */
  return [...new Set(value)].sort();
}

function getFieldsLanguageCodes(field) {
  const relevantSubfields = field.subfields.filter(sf => sf.code === 'a' || sf.code === 'd').filter(sf => isLangCodeForALanguage(sf.value, 'field'));

  const values = relevantSubfields.map(sf => sf.value).flat();

  return [...new Set(values)].sort();
}

function getSharedValues(list1, list2) {
  return list1.filter(val => list2.includes(val));
}
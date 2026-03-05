
import createDebugLogger from 'debug';
import {parse as isbnParse} from 'isbn3';

import {uniqArray} from './issn.js';
import {isComponentRecord} from '@natlibfi/melinda-commons';


const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:ISBN`);
const debugData = debug.extend('data');

const MAX_SCORE = 0.75;

export default () => ({
  name: 'ISBN',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    const host = !isComponentRecord(record, false, []);

    if (host) {
      return record.get('020').filter(f => f.subfields?.some(sf => ['a', 'z'].includes(sf.code) && sf.value));
    }
    return record.get('773').filter(f => f.subfields?.some(sf => ['z'].includes(sf.code) && sf.value));
  },
  // eslint-disable-next-line max-statements
  compare: (aa, bb) => {
    debugData(`Comparing ISBN sets ${JSON.stringify(aa)} and ${JSON.stringify(bb)}`);
    if (aa.length === 0 || bb.length === 0) {
      // No data for decision
      return 0;
    }

    const [subfieldCodeForGoodValues, subfieldCodeForBadValues] = getSubfieldCodes(aa[0].tag);

    const [aValidValuesA, aInvalidValuesA, zValidValuesA, zInvalidValuesA] = getValuesWrapper(aa, 'AA'); // initial 'a' and 'z' refer to 020 subfields codes
    const [aValidValuesB, aInvalidValuesB, zValidValuesB, zInvalidValuesB] = getValuesWrapper(bb, 'BB');

    function getValuesWrapper(data, prefix) {
      const [aValidValues, aInvalidValues, zValidValues, zInvalidValues] = getValues(data);
      if (aValidValues.length) {
        debug(`${prefix}: ${aa[0].tag}$${subfieldCodeForGoodValues} VALID: ${aValidValues.join(', ')}`);
      }
      if (aInvalidValues.length) {
        debug(`${prefix}: ${aa[0].tag}$${subfieldCodeForGoodValues} INVALID: ${aInvalidValues.join(', ')}`);
      }
      if (zValidValues.length) {
        debug(`${prefix}: ${aa[0].tag}$${subfieldCodeForBadValues} VALID: ${zValidValues.join(', ')}`);
      }
      if (zInvalidValues.length) {
        debug(`${prefix}: ${aa[0].tag}$${subfieldCodeForBadValues} INVALID: ${zInvalidValues.join(', ')}`);
      }
      return [aValidValues, aInvalidValues, zValidValues, zInvalidValues];
    }

    const [sharedGoodValues, goodValuesAOnly, goodValuesBOnly] = getUnionData(aValidValuesA, aValidValuesB);

    debug(`GOOD\tBOTH: ${sharedGoodValues.length}, A only: ${goodValuesAOnly.length}, B only: ${goodValuesBOnly.length}`);

    if (sharedGoodValues.length > 0) {
      // Third argument (aka 'N times') is >= 0
      return scoreData(MAX_SCORE, 0.8, goodValuesAOnly.length + goodValuesBOnly.length);
    }

    const hitScore = scoreSuboptimalHit();

    function scoreSuboptimalHit() {
      // One record consider ISBN good and the other record considered it's canceled:
      if (aValidValuesA.some(valA => zValidValuesB.includes(valA)) || aValidValuesB.some(valB => zValidValuesA.includes(valB))) {
        return MAX_SCORE;
      }

      // Subfield is for cancelled/whatever values, but the value is syntactically valid:
      // Could happen for two canceled ISBNs for example. I'll give this two thirds of the full score
      const zzValid = zValidValuesA.find(valA => zValidValuesB.includes(valA));
      if (zzValid) {
        debug(`Both contain a valid value in 020$z: ${zzValid}`);
        return MAX_SCORE * 2 / 3;
      }
      // Shared invalid identifiers:
      const aaInvalid = aInvalidValuesA.find(valA => aInvalidValuesB.includes(valA) || zInvalidValuesB.includes(valA)) || aInvalidValuesB.find(valB => zInvalidValuesA.includes(valB));
      if (aaInvalid) {
        debug(`Shared invalid value in 020$a and 020$a-or-$z subfields: ${aaInvalid}`);
        return MAX_SCORE * 2 / 3;
      }

      /* // Currently I think that paired invalid idenfiers in 020$z are meaningless...
      const zzInvalid = zInvalidValuesB.find(valB => zInvalidValuesA.includes(valB)) || zInvalidValuesA.find(valA => zInvalidValuesB.includes(valA));
      if (zzInvalid) {
        debug(`Shared invalid value in 020$z subfields: ${zzInvalid}`);
        return MAX_SCORE / 3;
      }
      */

      return 0;
    }



    if (hitScore === MAX_SCORE) {
      // -1 is needed to make the third argument >= 0 (otherwise min val would be 0)
      return scoreData(hitScore, 0.8, goodValuesAOnly.length + goodValuesBOnly.length - 1);
    }

    if (hitScore > 0) { // Canceled/invalid ISBNs match
      // Note that this is not (currently) penalized for non-matching canceled/invalid ISBNs. Maybe it should be.
      return scoreData(hitScore, 0.8, goodValuesAOnly.length + goodValuesBOnly.length);
    }

    // No match:

    if (aValidValuesA.length + aInvalidValuesA.length === 0 || aValidValuesB.length + aInvalidValuesB.length === 0) { // At least one record did not have any good ISBNs, so not penalizing here! (Invalid 020$as are counted a bad.)
      return 0.0;
    }
    // We have same matching invalid identifiers. Don't penalize:
    const allA = [...aValidValuesA, ...aInvalidValuesA, ...zValidValuesA, ...zInvalidValuesA];
    const allB = [...aValidValuesB, ...aInvalidValuesB, ...zValidValuesB, ...zInvalidValuesB];
    const [sharedValues, tmp1, tmp2] = getUnionData(allA, allB);
    debug(`WHATEVER\tBOTH: ${sharedGoodValues.length}, A only: ${tmp1.length}, B only: ${tmp2.length}`);

    if (sharedValues.length > 0) {
      return 0;
    }
    // We have values but they disagree:
    return -0.75; // Has good ISBNs on both records, but they did not match


    function getSubfieldCodes(tag) {
      if (tag === '773') {
        return ['z', undefined];
      }
      return ['a', 'z'];
    }

    function getValues(fields) {
      // Valid values are normalized to their isbn-13 form. Invalid values get their '-'s removed.
      const goodValues = fields.flatMap(f => f.subfields.filter(sf => sf.code === subfieldCodeForGoodValues)).map(sf => validatorAndNormalizer(sf.value));
      const trueGoodValues = goodValues.filter(val => val.valid).map(val => val.value);
      const wannabeGoodValues = goodValues.filter(val => !val.valid).map(val => val.value);
      if (!subfieldCodeForBadValues) { // 773
        return [trueGoodValues, wannabeGoodValues, [], []];
      }
      const badValues = fields.flatMap(f => f.subfields.filter(sf => sf.code === subfieldCodeForBadValues)).map(sf => validatorAndNormalizer(sf.value));
      const validBadValues = badValues.filter(val => val.valid).map(val => val.value);
      const invalidBadValues = badValues.filter(val => !val.valid).map(val => val.value);
      //const badValues = fields.flatMap(f => f.subfields.filter(sf => sf.code === subfieldCodeForBadValues)).map(sf => validatorAndNormalizer(sf.value).value);
      return [uniqArray(trueGoodValues), uniqArray(wannabeGoodValues), uniqArray(validBadValues), uniqArray(invalidBadValues)];
    }

    function validatorAndNormalizer(string) {
      const string2 = string.replace(/\. -$/u, ''); // Remove punctuation (773$z)

      // Hack: Historically we 020$a "1234567890 sidottu" etc. Try the LHS alone:
      const string3 = string2.replace(/ .*$/u, '');
      if (string2 !== string3) {
        const altResult = validatorAndNormalizer(string3);
        if (altResult.valid) {
          return altResult;
        }
      }

      const isbnParseResult = isbnParse(string2, '') || '';
      debugData(`isbnParseResult: ${JSON.stringify(isbnParseResult)}`);
      if (!isbnParseResult.isValid) {
        debug(`Not parseable ISBN '${string2}', just removing hyphens`);
        return {valid: false, value: string2.replace(/-/ug, '')};
      }

      debug(`Parseable ISBN '${string2}', normalizing to ISBN-13 '${isbnParseResult.isbn13}'`);
      return {valid: true, value: isbnParseResult.isbn13};


    }
  }
});

// These are outside the default function as I'll probably want to export these later on

function getUnionData(set1, set2) {
  const shared = set1.filter(val => set2.includes(val));
  const onlyInSet1 = set1.filter(val => !shared.includes(val));
  const onlyInSet2 = set2.filter(val => !shared.includes(val));
  return [shared, onlyInSet1, onlyInSet2];
}

function scoreData(score, factor, n) {
  return innerScoreData(score, n);
  function innerScoreData(currScore, remaining) {
    if (remaining > 0) {
      return innerScoreData(currScore * factor, remaining-1);
    }
    return Math.round(currScore * 100)/100; // 0.600000000001 => 0.6
  }
}
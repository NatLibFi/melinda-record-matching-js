
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

    const [goodValuesA, badValuesA] = getValues(aa);
    if (goodValuesA.length) {
      debug(`GOOD VALUES (A): ${goodValuesA.join(', ')}`);
    }
    if (badValuesA.length) {
      debug(`BAD VALUES (A): ${badValuesA.join(', ')}`);
    }

    const [goodValuesB, badValuesB] = getValues(bb);
    if (goodValuesB.length) {
      debug(`GOOD VALUES (B): ${goodValuesB.join(', ')}`);
    }
    if (badValuesB.length) {
      debug(`BAD VALUES (B): ${badValuesB.join(', ')}`);
    }

    const [sharedGoodValues, goodValuesAOnly, goodValuesBOnly] = getUnionData(goodValuesA, goodValuesB);

    //debug(`GOOD\tBOTH: ${sharedGoodValues.length}, A only: ${goodValuesAOnly.length}, B only: ${goodValuesBOnly.length}`);

    const hitScore = scoreHit();

    function scoreHit() {
      if (sharedGoodValues.length > 0) {
        return MAX_SCORE;
      }
      // One record consider ISBN good and the other record considered it's canceled:
      if (goodValuesA.some(valA => badValuesB.includes(valA)) || goodValuesB.some(valB => badValuesA.includes(valB))) {
        return MAX_SCORE;
      }

      // Value is bad, but looks isbn-ish to a human eye (not validating the isbn again, note than invalid isbns in 020$a are considered bad):
      // Could happen for two canceled ISBNs for example. I'll give this two thirds of the full score
      if (badValuesA.some(valA => looksGood(valA) && badValuesB.includes(valA)) || badValuesB.some(valB => looksGood(valB) && badValuesA.includes(valB))) {
        return MAX_SCORE * 2 / 3;
      }

      return 0;
    }

    if (sharedGoodValues.length > 0) {
      // Third argument (aka 'N times') is >= 0
      return scoreData(hitScore, 0.8, goodValuesAOnly.length + goodValuesBOnly.length);
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

    if (goodValuesA.length === 0 || goodValuesB === 0) { // At least one record did not have any good ISBNs, so not penalizing here! (Invalid 020$as are counted a bad.)
      return 0.0;
    }

    return -0.75; // Has good ISBNs on both records, but they did not match


    function getSubfieldCodes(tag) {
      if (tag === '773') {
        return ['z', undefined];
      }
      return ['a', 'z'];
    }

    function looksGood(val) {
      // isbn10 can end in X:
      if (/^([0-9]-?){9}[0-9X]$/u.test(val)) {
        return true;
      }
      // isbn13 can not:
      if (/^([0-9]-?){12}[0-9]$/u.test(val)) {
        return true;
      }
      return false;
    }

    function getValues(fields) {
      const goodValues = fields.flatMap(f => f.subfields.filter(sf => sf.code === subfieldCodeForGoodValues)).map(sf => validatorAndNormalizer(sf.value));
      const trueGoodValues = goodValues.filter(val => val.valid).map(val => val.value);
      const wannabeGoodValues = goodValues.filter(val => !val.valid).map(val => val.value);
      if (!subfieldCodeForBadValues) { // 773
        return [trueGoodValues, wannabeGoodValues];
      }
      const badValues = fields.flatMap(f => f.subfields.filter(sf => sf.code === subfieldCodeForBadValues)).map(sf => sf.value);
      return [uniqArray(trueGoodValues), uniqArray([...wannabeGoodValues, ...badValues])];
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
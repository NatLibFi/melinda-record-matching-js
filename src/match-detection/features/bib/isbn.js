
import createDebugLogger from 'debug';
import {parse as isbnParse} from 'isbn3';

import {isHostRecord} from './issn.js';

const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:ISBN`);
const debugData = debug.extend('data');

export default () => ({
  name: 'ISBN',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    const isHost = isHostRecord(record);

    if (isHost) {
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
    const [goodValuesB, badValuesB] = getValues(bb);

    if (goodValuesA.some(valA => goodValuesB.includes(valA)) || goodValuesB.some(valB => goodValuesA.includes(valB))) {
      return 0.75;
    }

    if (goodValuesA.some(valA => badValuesB.includes(valA)) || goodValuesB.some(valB => badValuesA.includes(valB))) {
      return 0.75;
    }

    // Value is bad, but looks isbn-ish to a human eye:
    if (badValuesA.some(valA => looksGood(valA) && badValuesB.includes(valA)) || badValuesB.some(valB => looksGood(valB) && badValuesA.includes(valB))) {
      return 0.5;
    }

    if (goodValuesA.length === 0 && goodValuesB === 0) {
      return 0.0;
    }
    return -0.75;


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
      return [trueGoodValues, [...badValues, ...wannabeGoodValues]];
    }

    function validatorAndNormalizer(string) {
      const isbnParseResult = isbnParse(string) || '';
      debugData(`isbnParseResult: ${JSON.stringify(isbnParseResult)}`);
      if (isbnParseResult === null) {
        debug(`Not parseable ISBN, just removing hyphens`);
        return {valid: false, value: string.replace(/-/ug, '')};
      }
      debug(`Parseable ISBN, normalizing to ISBN-13`);
      return {valid: true, value: isbnParseResult.isbn13};
    }
  }
});

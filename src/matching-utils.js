import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:utils');
const debugData = debug.extend('data');

export function getMelindaIdsF035(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:melinda-id');
  const debugData = debug.extend('data');

  const f035s = record.getFields('035');

  if (f035s.length < 1) {
    debug(`No f035s found.`);
    return [];
  }

  const allF035MelindaIds = [].concat(...f035s.map(field => toMelindaIds(field)));
  const f035MelindaIds = [...new Set(allF035MelindaIds)];

  debugData(`Fields (${f035s.length}): ${JSON.stringify(f035s)}`);
  debugData(`Ids (${allF035MelindaIds.length}): ${JSON.stringify(allF035MelindaIds)}`);
  debugData(`Unique ids (${f035MelindaIds.length}): ${JSON.stringify(f035MelindaIds)}`);

  return f035MelindaIds;
}

export function toMelindaIds({subfields}, subfieldsToParse = ['a', 'z']) {
  const melindaIdRegExp = /^(?<prefix>\(FI-MELINDA\)|FCC)(?<id>\d{9})$/u;

  return subfields
    .filter(sub => subfieldsToParse.includes(sub.code))
    .filter(sub => testStringOrNumber(sub.value) && melindaIdRegExp.test(String(sub.value)))
    .map(({value}) => testStringOrNumber(value) ? String(value).replace(melindaIdRegExp, '$<id>') : '');
}

export function validateSidFieldSubfieldCounts(field) {
  // Valid SID-fields have just one $c and one $b
  debugData(`Validating SID field ${JSON.stringify(field)}`);
  const countC = countSubfields(field, 'c');
  const countB = countSubfields(field, 'b');
  debug(`Found ${countC} sf $cs and ${countB} sf $bs. IsValid: ${countC === 1 && countB === 1}`);

  return countC === 1 && countB === 1;
}

function countSubfields(field, subfieldCode) {
  // debug(`Counting subfields ${subfieldCode}`);
  return field.subfields.filter(({code}) => code === subfieldCode).length;
}

export function getSubfieldValues(field, subfieldCode) {
  debugData(`Get subfield(s) $${subfieldCode} from ${JSON.stringify(field)}`);
  return field.subfields
    .filter(({code}) => code === subfieldCode)
    .map(({value}) => testStringOrNumber(value) ? String(value) : '')
    .filter(value => value);
}

export function testStringOrNumber(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return true;
  }
  return false;
}

export function extractSubfieldsFromField(field, subfieldCodes) {
  if (field === undefined || field.subfields === undefined) {
    return [];
  }
  const resultSubfields = field.subfields
    .filter(({code}) => subfieldCodes.includes(code))
    .map(({code, value}) => ({code, value: testStringOrNumber(value) ? String(value) : ''}))
    .filter(value => value);
  return resultSubfields;
}

export function uniqueSubfields(subfields) {
  return subfields.reduce((arr, e) => {
    if (!arr.find(item => item.code === e.code && item.value === e.value)) {
      const newArr = arr.concat(e);
      return newArr;
    }
    return arr;
  }, []);
}

export function getMatchCounts(aValues, bValues) {

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
}

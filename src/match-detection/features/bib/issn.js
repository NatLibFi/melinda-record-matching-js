/*
//import createInterface from './standard-identifier-factory.js';


export default () => {
  const {extract, compare} = createInterface({pattern: /^022$/u, subfieldCodes: ['a', 'z', 'y']});
  return {extract, compare, name: 'ISSN'};
};
*/


import createDebugLogger from 'debug';
const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:issn');
const debugData = debug.extend('data');

export default () => ({
  name: 'ISSN',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    const isHost = isHostRecord(record);
    debug(`\t Is HOST: '${isHost}'`);
    return getIssns();

    function getIssns() {
      const fields = getRelevantFields();
      debug(`\t N fields: '${fields.length}'`);
      if (fields.length === 0) {
        return [];
      }
      const subfieldCodes = getRelevantSubfieldCodes();
      debug(`\t subfield codes: '${subfieldCodes.join("', '")}'`);
      const subfieldValues = fields.flatMap(f => f.subfields.filter(sf => subfieldCodes.includes(sf.code)).map(sf => sf.value));
      debug(`\t cand values: '${subfieldValues.join("', '")}'`);
      // Stripping punctuaction with substring here is pretty quick and dirty approach...
      const validSubfieldValues = subfieldValues?.map(val => normalizeSubfieldValue(val)).filter(val => isValidIssn(val));
      if (!validSubfieldValues) {
        return [];
      }
      return uniqArray(validSubfieldValues);
    }

    function getRelevantFields() {
      if (isHost) {
        return record.get(/^022$/u);
      }
      return record.get(/^[79]73$/u);
    }

    function normalizeSubfieldValue(val) {
      return val.replace(/[., :;].*$/u, '');
    }

    function isValidIssn(val) {
      return /^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9X]$/u.test(val);
    }

    function getRelevantSubfieldCodes() {
      if (isHost) {
        return ['a', 'y', 'z'];
      }
      return ['x'];
    }
  },
  // eslint-disable-next-line max-statements
  compare: (aa, bb) => {
    debugData(`Comparing ISSN sets ${JSON.stringify(aa)} and ${JSON.stringify(bb)}`);
    if (aa.length === 0 || bb.length === 0) {
      // No data for decision
      return 0;
    }
    const firstSharedIssn = aa.find(val => bb.includes(val));
    if (firstSharedIssn) {
      debug(`\t Shared ISSN found: '${firstSharedIssn}'`);
      // Maybe less for comps?
      return 0.2;
    }
    return -0.2;

  }
});

export function isHostRecord(record) {
  const ldr07 = record.leader?.charAt(7) || '?';
  return !['a', 'b', 'd'].includes(ldr07);
}

export function uniqArray(arr) {
  return arr.filter((val, i) => arr.indexOf(val) === i);
}
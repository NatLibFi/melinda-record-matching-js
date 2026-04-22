
import createDebugLogger from 'debug';
import {recordGetAuthIdentifiers} from '../../../candidate-search/query-list/auth.js';
//import {fieldToString} from '@natlibfi/marc-record-validators-melinda';

//import {isComponentRecord} from '@natlibfi/melinda-commons';
//import {uniqArray} from './issn.js';
//import {parse773g} from '../../../candidate-search/query-list/component.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:auth:yso');
const debugData = debug.extend('data');



function getSubjectHeadingThesaurus(record) {
  // Quick'n'dirty: we could/should check 008/11 first. Now we just assume it is 'z'
  const [f040] = record.get('040');
  if (f040) {
    // debug(`FOUND 040: ${fieldToString(f040)}`);
    const sf = f040.subfields?.find(sf => sf.code === 'f');
    if (sf) {
      return sf.value;
    }
  }
  return undefined;
}

export default () => ({
  name: 'yso',
  extract: ({record/*, recordExternal*/}) => {
    const identifiers = recordGetAuthIdentifiers(record);

    const thesaurus = getSubjectHeadingThesaurus(record);


    debug(`EXTRACT ${thesaurus}: ${identifiers.join(', ')}`);
    return {identifiers, thesaurus};
  },

  compare: (aa, bb) => {
    const aIdentifiers = aa.identifiers;
    const aThesaurus = aa.thesaurus;
    const bIdentifiers = bb.identifiers;
    const bThesaurus =  bb.thesaurus;

    // Require identical existing thesauri
    if (!aThesaurus || aThesaurus !== bThesaurus) {
      return -1.0;
    }
    debugData(`Shared thesaurus: ${aThesaurus}`)

    //// Check that identifiers match:
    // debug(aIdentifiers.join(' -- '));
    // debug(bIdentifiers.join(' -- '));
    const sharedIdentifier = aIdentifiers.find(id => bIdentifiers.includes(id));
    if (!sharedIdentifier) {
      return -1.0;
    }
    debugData(`Shared identifier: ${sharedIdentifier} => MATCH`);

    return 1.0;
  }
});


// NB! This checks identifiers ($w=ID, $x=ISSN, $z=ISBN and $o=others) to check whether the host is the same.
// BB! $g is not checked *yet*. It could very strongly indicate that the records are the same... (I doubt $q could be useful here)
// Rationale:
// 773$w indicates sameness. However, non-Melinda records probably refer to non-melinda hosts.
// Thus check other identifiers subfields ($x, $z and $o as well)
//


import createDebugLogger from 'debug';

import {isComponentRecord} from '@natlibfi/melinda-commons';
import {uniqArray} from './issn.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:issn');
const debugData = debug.extend('data');

export default () => ({
  name: 'f773 ',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    if (!isComponentRecord(record, false, [])) {
      return [];
    }
    const f773s = record.get(/^773$/u);

    // I think it's ok, if, say, $o and $x values match, so I'm not keeping the subfield codes
    const values = f773s.map(f => f.subfields)
      .flat()
      .filter(sf => ['w', 'o', 'x', 'z'].includes(sf.code))
      .map(sf =>  normalizeValue(sf.value));

    const g = f773s.map(f => f.subfields)
      .flat()
      .filter(sf => sf.code === 'g')
      .map(sf => normalizeValue(sf.value));

    return [uniqArray(values), g];

    function normalizeValue(value) {
      return value.replace(/\. -$/u, '');
    }
  },

  compare: (aa, bb) => {
    const [aIdentifiers, ag] = aa;
    const [bIdentifiers, bg] = bb;

    const identifierScore = scoreIdentifiers();
    const gScore = scoreG();

    return identifierScore + gScore;

    function scoreG() {
      // Not implemented.
      // We could compare year, volume (not that relevant), issue and pages...
      return 0.0;
    }

    function scoreIdentifiers() {
      debugData(`Comparing ISSN sets ${JSON.stringify(aIdentifiers)} and ${JSON.stringify(bIdentifiers)}`);
      if (aIdentifiers.length === 0 || bIdentifiers.length === 0) {
        // No data for decision
        return 0;
      }
      const firstSharedIdentifier = aIdentifiers.find(val => bIdentifiers.includes(val));
      if (firstSharedIdentifier) {
        debug(`\t Shared identifier found: '${firstSharedIdentifier}'`);
        return 0.2;
      }
      return -0.5;
    }
  }
});


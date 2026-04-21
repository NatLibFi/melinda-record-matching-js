// NB! This checks identifiers ($w=ID, $x=ISSN, $z=ISBN and $o=others) to check whether the host is the same.
// BB! $g is not checked *yet*. It could very strongly indicate that the records are the same... (I doubt $q could be useful here)
// Rationale:
// 773$w indicates sameness. However, non-Melinda records probably refer to non-melinda hosts.
// Thus check other identifiers subfields ($x, $z and $o as well)
//


import createDebugLogger from 'debug';

import {isComponentRecord} from '@natlibfi/melinda-commons';
import {uniqArray} from './issn.js';
import {parse773g} from '../../../candidate-search/query-list/component.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:issn');
const debugData = debug.extend('data');

const MAX_IDENTIFIER = 0.1; // This should be pretty low: it only says something about the host
const MAX_G = 0.5; // $g is about the comp itself, so score can be high here

export default () => ({
  name: 'f773 ',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    if (!isComponentRecord(record, false, [])) {
      return [];
    }
    const f773s = record.get(/^773$/u); // Identifier extract handles multiple 773...

    // I think it's ok, if, say, $o and $x values match, so I'm not keeping the subfield codes
    const values = f773s.map(f => f.subfields)
      .flat()
      .filter(sf => ['w', 'o', 'x', 'z'].includes(sf.code))
      .map(sf =>  normalizeValue(sf.value));

    // $g: only on $g is supported
    const gData = parse773g(f773s[0]);

    return [uniqArray(values), gData];

    function normalizeValue(value) {
      return value.replace(/(?:\. -|\.)$/u, '');
    }


  },

  compare: (aa, bb) => {
    const [aIdentifiers, ag] = aa;
    const [bIdentifiers, bg] = bb;

    const identifierScore = scoreIdentifiers();
    const gScore = scoreG();

    if (identifierScore === MAX_IDENTIFIER && gScore === MAX_G) { // Pretty impressive hit, even if title matches not
      return 1.0;
    }

    return identifierScore + gScore;

    function scoreG() {
      // NB! $g contents are very noise, so wrong values may be extracted. Thus do not overpenalize.

      // All exist match: things must be pretty good:
      if (ag.number && ag.number === bg.number && ag.pages && ag.pages === bg.pages && ag.year && ag.year === bg.year) {
        return MAX_G;
      }
      // Not comparing volume. It correlates with year.
      return scoreYear() + scoreNumber() + scorePages();
    }

    function scoreNumber() {
      if (!ag.number || !bg.number) {
        return 0.0;
      }
      if (ag.number === bg.number) {
        return 0.05;
      }
      return -0.02;
    }

    function scorePages() {
      if (!ag.pages || !bg.pages) {
        return 0.0;
      }
      if (ag.pages === bg.pages) { // If pages match, things must be pretty good
        return 0.1;
      }
      return -0.05;
    }

    function scoreYear() { // publication-time.js also uses this, so don't score heavily here
      if (!ag.year || !bg.year) {
        return 0.0;
      }
      if (ag.year === bg.year) {
        return 0.02;
      }
      return -0.02;
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
        return MAX_IDENTIFIER;
      }
      return -0.5;
    }
  }
});


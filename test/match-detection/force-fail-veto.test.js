import assert from 'node:assert';
import {describe, it} from 'node:test';
import {MarcRecord} from '@natlibfi/marc-record';

import createDetectionInterface from '../../src/match-detection/index.js';
import * as features from '../../src/match-detection/features/index.js';

// LDR/07 = 's' (bibliographic level: serial)
const SERIAL_LEADER = '02518cas s2200745zi 4500';

function makeRecord(f338Code) {
  const json = {
    leader: SERIAL_LEADER,
    fields: [
      {tag: '022', ind1: ' ', ind2: ' ', subfields: [{code: 'a', value: '1234-5678'}]},
      {tag: '338', ind1: ' ', ind2: ' ', subfields: [{code: 'b', value: f338Code}]}
    ]
  };
  return new MarcRecord(json, {subfieldValues: false});
}

describe('match-detection: FORCE_FAIL veto end-to-end', () => {
  function detect(recordA, recordB) {
    const interfaceFactory = createDetectionInterface({
      threshold: 0.5,
      strategy: [
        features.bib.issn({positiveWeight: 0.75}),
        features.bib.f338()
      ]
    });
    return interfaceFactory({recordA, recordB});
  }

  it('veto: disjoint 338 $b on two serials sharing an ISSN -> no match, 0.0', () => {
    const recordA = makeRecord('nc');
    const recordB = makeRecord('nb');

    assert.deepStrictEqual(detect(recordA, recordB), {match: false, probability: 0.0});
  });

  it('control: shared 338 $b -> veto does not fire, ISSN weight 0.75 survives', () => {
    const recordA = makeRecord('nc');
    const recordB = makeRecord('nc');

    assert.deepStrictEqual(detect(recordA, recordB), {match: true, probability: 0.75});
  });
});

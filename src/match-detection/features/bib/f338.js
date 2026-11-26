import createDebugLogger from 'debug';

import isSerial from './is-serial.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/f338');

// 338 $b disjoint-code gate (heili-quria serial matching, change 4; owner rulings
// 2026-11-24 + 2026-11-25 generalization):
// - both sides carry at least one 338 $b and the code sets are disjoint ->
//   -1.0 force-fail, in both directions
// - the code sets share at least one code -> 0
// - either side without any 338 $b -> skipped (0)
// No indicators, no 008/22 -- 338 $b values only.
// Subject to the pair-level seriality precondition: skipped (0) unless at least
// one side is serial (see is-serial.js). Deliberately lenient: a monograph
// carrying a conflicting 338 $b can still be force-failed against a serial --
// accepted, since monographs with differing 338 should not match either -- in
// exchange for covering mis-leadered serials (owner sign-off 2026-11-26).

export default () => ({
  name: 'f338',
  extract: ({record}) => {
    const codes = record.get(/^338$/u)
      .flatMap(field => (field.subfields || []).filter(sf => sf.code === 'b'))
      .map(sf => String(sf.value).trim().toLowerCase())
      .filter(value => value !== '');

    return {serial: isSerial(record), codes};
  },
  compare: (a, b) => {
    debug(`Comparing ${JSON.stringify(a)} to ${JSON.stringify(b)}`);

    // Seriality precondition: non-serial x non-serial pairs skip the feature
    if (!a.serial && !b.serial) {
      return 0;
    }

    if (a.codes.length === 0 || b.codes.length === 0) {
      debug(`\t One side has no 338 $b codes, skipping`);
      return 0;
    }

    const codesB = new Set(b.codes);
    const sharesCode = a.codes.some(code => codesB.has(code));
    if (sharesCode) {
      return 0;
    }

    debug(`\t Disjoint 338 $b code sets: ${JSON.stringify(a.codes)} vs ${JSON.stringify(b.codes)}`);
    return -1.0;
  }
});

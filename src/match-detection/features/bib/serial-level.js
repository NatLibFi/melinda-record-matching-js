import createDebugLogger from 'debug';

import isSerial from './is-serial.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/serial-level');

// Coverage split with the sibling feature: serialLevel covers the SERIAL axis
// (whole serial vs component volume/issue); setVolumeLevel covers the
// monograph/set axis (set vs volume vs media component). The two features are
// complementary -- their only shared signal zone is 245 $a/$n.

// A "valid year" is a 4-digit year 1600-2099, word-bounded: word boundaries
// prevent matching inside longer digit runs ('12026' -> no match) and let
// year-issue shapes work ('2004:8.' -> 2004, '2005-2006' -> 2005)
const YEAR_RE = /\b(1[6-9]\d{2}|20\d{2})\b/u;

// A digit range in 245 $a/$b/$n (1-4 digits, dash, 1-4 digits, e.g. '1-5',
// '2001-2005', '2001-5', 'vols. 1-5'); word bounds keep 5+ digit runs from
// matching on either side, and a single year WITHOUT a range never matches
const RANGE_RE = /\b\d{1,4}[-–—]\d{1,4}\b/u;

// 008 d2 "open" set (2026-11-25: unfilled/blank d2 counts as open, the dominant
// open coding). '' is the all-blank case after trimming
const OPEN_D2 = new Set(['0000', '9999', 'uuuu', '^^^^', '||||', '????', '****', '']);

// Serial level (whole vs component: issue/volume or article) discriminator,
// v3 (owner re-rule 2026-11-25). A side is COMPONENT-level when ANY of its
// per-record signals fires:
// (a) D2        -- 008 d1 is a valid year AND d2 is open AND d1 appears as a whole
//                  word in the combined 245 $a text ($a-only equality)
// (b) yr245n    -- the combined 245 $n text contains a valid year
// (c) keyTitle  -- a valid year in the combined 245 $a AND at least one of
//                  130/210/222/240 present (raw text non-empty) AND the combined
//                  130/210/222/240 text, with every parenthesized group containing
//                  a 4-digit year stripped first, contains no valid year
// (d) lvms      -- (pair signal) this side LDR idx7 = m and the other = s, or vice
//                  versa (read raw, no padding/alignment)
// (e) 773       -- a 773 field is present (kept despite hostComponent
//                  shadowing it in every current strategy: safety net for
//                  a strategy without hostComponent, owner 2026-11-26)
// (f) singleYr  -- 008 d1 == d2, 4-digit, not 0000/9999
// (g) range245  -- the combined 245 $a/$b/$n text contains a digit range
//                  (RANGE_RE: 1-4 digits, dash, 1-4 digits)
// Exactly one side component-level (or lvms) -> -1.0 force-fail, both directions;
// same level -> 0. Short-008 rule: positions beyond the 008 field's actual length
// are BLANK (a missing d2 is blank = open; a missing/short d1 has no valid year).
// Subject to the pair-level seriality precondition (see is-serial.js).

export default () => ({
  name: 'Serial level (whole vs component)',
  extract: ({record}) => {
    const value008 = record.get(/^008$/u)?.[0]?.value || '';
    // Short-008 rule: pad with BLANK (spaces), no padding/alignment tricks
    const d1 = String(value008).slice(7, 11).padEnd(4, ' ');
    const d2 = String(value008).slice(11, 15).padEnd(4, ' ');

    const a245 = combinedSubfield(record, '245', 'a');
    const b245 = combinedSubfield(record, '245', 'b');
    const n245 = combinedSubfield(record, '245', 'n');
    const keyTitleText = ['130', '210', '222', '240'].map(tag => combinedSubfieldsAll(record, tag)).join(' ');

    const signals = [];

    // (a) D2: d1 a whole word of 4 digits (short d1 -> no valid year), a valid year,
    // d2 open, and d1 present as a whole word in the combined 245 $a ($a-only)
    const d1isYear = /^\d{4}$/u.test(d1) && YEAR_RE.test(d1);
    if (d1isYear && OPEN_D2.has(d2.trim()) && new RegExp(`\\b${d1}\\b`, 'u').test(a245)) {
      signals.push('D2');
    }

    // (b) yr245n: valid year anywhere in the combined 245 $n
    if (YEAR_RE.test(n245)) {
      signals.push('yr245n');
    }

    // (g) range245: a digit range anywhere in the combined 245 $a/$b/$n text
    if (RANGE_RE.test(`${a245} ${b245} ${n245}`)) {
      signals.push('range245');
    }

    // (c) keyTitle: title year + key-title fields without a year (parenthesized
    // groups containing a 4-digit year are same-name qualifiers, stripped first)
    const keyTitleStripped = keyTitleText.replace(/\([^()]*\d{4}[^()]*\)/gu, '');
    if (YEAR_RE.test(a245) && keyTitleText.trim() !== '' && !YEAR_RE.test(keyTitleStripped)) {
      signals.push('keyTitle');
    }

    // (e) 773 present
    if (record.get(/^773$/u).length > 0) {
      signals.push('773');
    }

    // (f) singleYr
    if (/^\d{4}$/u.test(d1) && d1 === d2 && d1 !== '0000' && d1 !== '9999') {
      signals.push('singleYr');
    }

    const l7 = (record.leader || '').slice(7, 8) || '';
    const result = {serial: isSerial(record), l7, component: signals.length > 0, signals};
    debug(`Extracted: ${JSON.stringify(result)}`);
    return result;
  },
  compare: (a, b) => {
    debug(`Comparing ${JSON.stringify(a)} to ${JSON.stringify(b)}`);

    // Seriality precondition: non-serial x non-serial pairs skip the feature
    if (!a.serial && !b.serial) {
      return 0;
    }

    // (d) lvms: level mismatch in the leader, read raw idx7 directly
    const lvms = (a.l7 === 'm' && b.l7 === 's') || (a.l7 === 's' && b.l7 === 'm');
    if (a.component !== b.component || lvms) {
      debug(`\t Level mismatch: A ${JSON.stringify(a.signals)} (l7 '${a.l7}') vs B ${JSON.stringify(b.signals)} (l7 '${b.l7}')`);
      return -1.0;
    }
    return 0;
  }
});

// All subfields of the given code across ALL occurrences of the field, joined
function combinedSubfield(record, tag, code) {
  return record.get(new RegExp(`^${tag}$`, 'u'))
    .flatMap(field => (field.subfields || []).filter(sf => sf.code === code).map(sf => String(sf.value)))
    .join(' ');
}

// All subfields (any code) across ALL occurrences of the field, joined
function combinedSubfieldsAll(record, tag) {
  return record.get(new RegExp(`^${tag}$`, 'u'))
    .flatMap(field => (field.subfields || []).map(sf => String(sf.value)))
    .join(' ');
}

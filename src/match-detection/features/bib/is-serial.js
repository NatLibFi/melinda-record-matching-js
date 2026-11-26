// Pair-level seriality precondition helper.
//
// S(r) := LDR/07 = s (bibliographic level: serial)
//        OR 022 $a/$y/$z non-empty
//        OR 008/06 (0-based idx 6, type of date / publication status) in {s, c, d}
//
// Used by the f338, serial-level and publisher features: each of those
// computes the per-side flag at extract time and skips the comparison (returns 0)
// unless the flag is true on at least one side of the pair. Deliberately lenient:
// the rules it guards target mis-leadered serials too.

export default (record) => {
  const leader = record.leader || '';
  if (leader[7] === 's') {
    return true;
  }

  const f022s = record.get(/^022$/u);
  if (f022s.some(field => (field.subfields || []).some(sf => ['a', 'y', 'z'].includes(sf.code) && String(sf.value).trim() !== ''))) {
    return true;
  }

  const value008 = record.get(/^008$/u)?.[0]?.value;
  const typeOfDate = value008 ? String(value008).slice(6, 7) : '';
  return ['s', 'c', 'd'].includes(typeOfDate);
};

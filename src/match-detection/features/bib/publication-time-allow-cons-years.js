
import createDebugLogger from 'debug';
import {testStringOrNumber} from '../../../matching-utils.js';
import {matchingYears} from './publication-time.js';

// We should also get copyright time and copyright/publication times from 26x

export default (options) => ({
  name: 'Publication time, allow consequent years',
  extract: ({record}) => {
    const value = record.get(/^008$/u)?.[0]?.value || undefined;
    return testStringOrNumber(value) ? [String(value).slice(7, 11)] : [];
  },
  compare: (a, b) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/publication-time-allow-cons-years');
    debug(`Comparing ${a[0]} to ${b[0]}`);

    const [firstA] = a;
    const [firstB] = b;

    // No-valid-year shape: when either side lacks a real year (exactly 4 digits,
    // not the sentinel values 0000/9999) the comparison is neutral (0), not a
    // force-fail, in both directions (unknown-data neutralization). Identical
    // unknowns (e.g. 'uuuu' vs 'uuuu', no year on either side) must not score a
    // match either, so this check runs before the equality shortcut
    // (same semantics as the multi feature; gradablePenalty does not govern this
    // path).
    if (!hasValidYear(a) || !hasValidYear(b)) {
      return 0;
    }

    // Sanity check: If either of years is a non string/number, values are not comparable
    if (!testStringOrNumber(firstA) || !testStringOrNumber(firstB)) {
      return 0.0;
    }

    if (firstA === firstB) {
      return 0.1;
    }
    if (matchingYears(firstA, firstB)) { // Handle 'u' Eg. '18uu' vs '1812'
      return 0.05;
    }

    const firstANumber = parseInt(firstA, 10);
    const firstBNumber = parseInt(firstB, 10);

    if (isNaN(firstANumber) || isNaN(firstBNumber)) {
      return -1;
    }

    // Handle consequent years as a match
    // see publication-time for a version that does not handle consequent years as a match
    if (firstANumber + 1 === firstBNumber || firstANumber - 1 === firstBNumber) {
      return 0.1;
    }

    // gradablePenalty is an explicit opt-in: without it (or with anything but
    // exactly true) non-matching years keep the force-fail default of -1
    if (options?.gradablePenalty === true) {
      const gap = Math.abs(firstANumber - firstBNumber);
      if (gap <= 3) { return -0.1; }
      if (gap <= 7) { return -0.3; }
      if (gap <= 15) { return -0.5; }
      return -0.7;
    }

    return -1;

    function hasValidYear(side) {
      return (side || []).some(value => {
        const str = String(value);
        return /^\d{4}$/u.test(str) && str !== '0000' && str !== '9999';
      });
    }
  }
});

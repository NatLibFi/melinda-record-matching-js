
import {testStringOrNumber} from '../../../matching-utils';
import createDebugLogger from 'debug';

// We should also get copyright time and copyright/publication times from 26x

export default () => ({
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

    if (firstA === firstB) {
      return 0.1;
    }

    // If either of years is a non string/number, values are not comparable
    if (!testStringOrNumber(firstA) || !testStringOrNumber(firstB)) {
      return 0;
    }

    const firstANumber = parseInt(firstA, 10);
    const firstBNumber = parseInt(firstB, 10);

    if (isNaN(firstANumber) || isNaN(firstBNumber)) {
      return -1;
    }

    // Handle consequent years as a match
    // see publication-time for a version that does not handle consequent years as a match
    return firstANumber + 1 === firstBNumber || firstANumber - 1 === firstBNumber ? 0.1 : -1;
  }
});

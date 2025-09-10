

import {testStringOrNumber} from '../../../matching-utils.js';

// We should also get copyright time and copyright/publication times from 26x
// see publication-time-allow-cons-years for a version allowing consequent years to match

export default () => ({
  name: 'Publication time',
  extract: ({record}) => {
    const value = record.get(/^008$/u)?.[0]?.value || undefined;
    return testStringOrNumber(value) ? [String(value).slice(7, 11)] : [];
  },
  compare: (a, b) => a[0] === b[0] ? 0.1 : -1.0
});




import {LevenshteinDistance as leven} from 'natural';
import {testStringOrNumber} from '../../../matching-utils';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:title');
const debugData = debug.extend('data');


export default ({treshold = 10} = {}) => ({
  name: 'Title',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const title = getTitle();
    debug(`${label} title: ${title}`);

    if (testStringOrNumber(title)) {
      const titleAsNormalizedString = String(title)
        // decompose unicode diacritics
        .normalize('NFD')
        // strip non-letters/numbers
        // - note: combined with decomposing unicode diactics this normalizes both 'saa' and 'sää' as 'saa'
        // - we could precompose the finnish letters back to avoid this
        .replace(/[^\p{Letter}\p{Number}]/gu, '')
        .toLowerCase();
      debug(`${label} titleString: ${titleAsNormalizedString}`);
      return [titleAsNormalizedString];
    }

    return [];

    function getTitle() {
      const [field] = record.get(/^245$/u);
      debugData(`${label} titleField: ${JSON.stringify(field)}`);

      if (field) {
        return field.subfields
          // get also $n:s and $p:s here
          .filter(({code}) => ['a', 'b', 'n', 'p'].includes(code))
          .map(({value}) => testStringOrNumber(value) ? String(value) : '')
          .join('');
      }
      return false;
    }
  },
  compare: (a, b) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/title');
    const distance = leven(a[0], b[0]);

    if (distance === 0) {
      return 0.5;
    }

    const maxLength = getMaxLength();
    const percentage = distance / maxLength * 100;

    debug(`'${a}' vs '${b}': Max length = ${maxLength}, distance = ${distance}, percentage = ${percentage}`);

    if (percentage <= treshold) {
      return 0.3;
    }

    return -0.5;

    function getMaxLength() {
      return a[0].length > b[0].length ? a[0].length : b[0].length;
    }

  }
});

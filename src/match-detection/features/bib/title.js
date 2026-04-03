import createDebugLogger from 'debug';
import naturalPkg from 'natural';
const {LevenshteinDistance: leven} = naturalPkg;
import {testStringOrNumber} from '../../../matching-utils.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:title');
const debugData = debug.extend('data');


export default ({threshold = 10} = {}) => ({
  name: 'Title',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const title = getTitle(record);
    debug(`${label}: title: ${title}`);

    if (title) {
      const mainTitle = normalizeTitle(getTitle(record, ['a'])); // TODO: Return main title
      const titleAsNormalizedString = normalizeTitle(String(title));
      debug(`${label}: titleString: ${titleAsNormalizedString}`);
      return [titleAsNormalizedString];
    }

    return [];

    function normalizeTitle(title) {
      return title
        // decompose unicode diacritics
        .normalize('NFD')
        // strip non-letters/numbers
        // - note: combined with decomposing unicode diacritics this normalizes both 'saa' and 'sää' as 'saa'
        // - we could precompose the Finnish letters back to avoid this
        // - see validator normalize-utf8-diacritics for details
        .replace(/[^\p{Letter}\p{Number}]/gu, '')
        .toLowerCase();
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

    if (percentage <= threshold) {
      return 0.3;
    }

    return -0.5;

    function getMaxLength() {
      return a[0].length > b[0].length ? a[0].length : b[0].length;
    }

  }
});

export function getTitle(record, targetSubfieldCodes = ['a', 'b', 'n', 'p']) {
  const [field] = record.get(/^245$/u);
  debugData(`titleField: ${JSON.stringify(field)}`);

  if (field) {
    const title = field.subfields
      // get also $n:s and $p:s here
      .filter(({code}) => targetSubfieldCodes.includes(code))
      // Would be nice to normalize $n values...
      .map(({value}) => testStringOrNumber(value) ? String(value) : '')
      .join(' ')
      .replace(/ [=\/:](?:$| )/ug, ' ')
      .replace(/(?:đ|ȧ)/ug, '') // Hack. Saamelaisbibliografia has often dropped this character
      // trim:
      .replace(/ +/ug, ' ')
      .replace(/^ +/u, '')
      .replace(/ +$/u, '');

    // Skip non-filing indicator (note that '9' is a magic indicator value, so we don't do it):
    if (/^[1-8]$/u.test(field.ind2)) { // Skip non-filing characters
      return title.slice(parseInt(field.ind2));
    }
    return title;

  }
  return false;
}
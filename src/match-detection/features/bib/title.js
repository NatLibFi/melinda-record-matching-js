import createDebugLogger from 'debug';
import naturalPkg from 'natural';
const {LevenshteinDistance: leven} = naturalPkg;
import {testStringOrNumber} from '../../../matching-utils.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:title');
const debugData = debug.extend('data');


export default ({threshold = 0.9} = {}) => ({
  name: 'Title',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const a = getTitle(record, ['a']);
    debug(`${label}: title: ${a}`);

    if (a) {
      const b = normalizeTitle(getTitle(record, ['b']));
      const n = normalizeTitle(getTitle(record, ['n']));
      const p = normalizeTitle(getTitle(record, ['p']));
      return [normalizeTitle(a), b, n, p];
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
    const [aa, ab, an, ap] = a;
    const [ba, bb, bn, bp] = b;
    const aFull = toFullTitle(a);
    const bFull = toFullTitle(b);

    if (an && bn && an !== bn) { // If these exists, they must be the same (we might convert Roman numbers to Arabic numbers though)
      return -1.0;
    }

    const distance = leven(aFull, bFull);

    if (distance === 0) {
      return 0.5;
    }

    const maxLength = getMaxLength();
    const correctness = 1.0 - (distance / maxLength);

    debug(`'${aFull}' vs '${bFull}': Max length = ${maxLength}, distance = ${distance}, correctness = ${correctness}`);

    if (correctness >= threshold) {
      return 0.3;
    }

    return -0.5;

    function toFullTitle(arr) {
      const relevant = arr.filter(val => typeof val === 'string' && val.length);
      return relevant.join(' ');
    }

    function getMaxLength() {
      return aFull.length > bFull.length ? aFull.length : bFull.length;
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
      .replace(/(?:đ|ȧ|t̄)/ug, '') // Hack. Saamelaisbibliografia has often dropped this wierod characters (oft old articles, no longer used in sami either)
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
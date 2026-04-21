import createDebugLogger from 'debug';
import naturalPkg from 'natural';
const {LevenshteinDistance: leven} = naturalPkg;
import {testStringOrNumber} from '../../../matching-utils.js';


const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/title');
const debugData = debug.extend('data');

export default ({threshold = 0.9} = {}) => ({
  name: 'Title',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const a = getTitle(record, ['a']);
    debug(`${label}: title: ${a}`);

    if (a) {
      const b = normalizeTitle(getTitle(record, ['b'])) || '';
      const n = normalizeTitle(getTitle(record, ['n'])) || '';
      const p = normalizeTitle(getTitle(record, ['p'])) || '';
      return [normalizeTitle(a), b, n, p];
    }

    return ['', '', '', ''];

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
    const [aa, ab, an, ap] = a;
    const [ba, bb, bn, bp] = b;

    if (isEmpty(aa) || isEmpty(ba)) {
      return -1.0;
    }
    // F245$n information is critical; it can not mismatch at all:
    if (an.length && bn.length && an !== bn) { // If these exists, they must be the same (we might convert Roman numbers to Arabic numbers though)
      return -1.0;
    }

    const aFull = toFullTitle(a);
    const bFull = toFullTitle(b);

    const [distance, maxLength, correctness] = doLevenshtein(aFull, bFull);

    debug(`'${aFull}' vs '${bFull}': Max length = ${maxLength}, distance = ${distance}, correctness = ${correctness}`);

    if (distance === 0) {
      return 0.5;
    }

    if (correctness >= threshold) {
      return 0.4;
    }

    if (an && bn) {
      // There seems to be some wobble between $b and $p, for example:
      if (ab && isEmpty(ap) && bp && isEmpty(bb)) {
        return compare([aa, ap, an, ab], [ba, bb, bn, bp]);
      }
      if (ap && isEmpty(ab) && bb && isEmpty(bp)) {
        return compare([aa, ab, an, ap], [ba, bp, bn, bb]);
      }
    }

    // Try the same without $p:
    if (localXor(ap, bp)) {
      const result = compare([aa, ab, an, ''], [ba, bb, bn, '']);
      return result > 0.0 ? result * 0.8 : result;
    }

    if (isEmpty(ap) && isEmpty(bp) && localXor(ab, bb)) {
      // Try the same without $b ($p is not here)
      const result = compare([aa, '', an, ''], [ba, '', bn, '']);
      return result > 0.0 ? result * 0.8 : result;
    }

    return -0.5; // Not likely

    function isEmpty(x) {
      return !x || x.length === 0;
    }

    function localXor(x, y) {
      if (isEmpty(x)) {
        return !isEmpty(y);
      }
      // 'x' exists, thus 'y' can not exist:
      return isEmpty(y);
    }

    function doLevenshtein(string1, string2) {
      const distance = leven(string1, string2);
      const len = getMaxLength(string1, string2);
      const correctness = 1.0 - (distance / len);
      return [distance, len, correctness];
    }

    function toFullTitle(arr) {
      const relevant = arr.filter(val => typeof val === 'string' && val.length);
      return relevant.join(' ');
    }

    function getMaxLength(str1, str2) {
      return str1.length > str2.length ? str1.length : str2.length;
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
      .replace(/\[[^\]]*\]/ug, ' ') // Remove [whatever] stuff. ADD TEST FOR THIS
      .replace(/ [=\/:](?:$| )/ug, ' ') // Strip punctuation
      // Also đ vs d pairs seen:
      //.replace(/(?:đ|ȧ|t̄|ǩ|ǧ|s̆|c̆)/ug, '') // Hack. Saamelaisbibliografia has often dropped this wierd characters (oft old articles, no longer used in sami either)
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
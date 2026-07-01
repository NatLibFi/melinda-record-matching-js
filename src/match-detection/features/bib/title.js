import createDebugLogger from 'debug';
import naturalPkg from 'natural';
const {LevenshteinDistance: leven} = naturalPkg;
import {testStringOrNumber} from '../../../matching-utils.js';
import { subfieldToString } from '@natlibfi/marc-record-validators-melinda/dist/utils.js';


const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/title');
const debugData = debug.extend('data');

const TITLE_MAX = 0.5;
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
        .replace(/\b(?:ein|ett|I|one|uno|yksi)\b/uig, '1')
        .replace(/\b(?:dos|kaksi|II|två|two|zwei)\b/uig, '2')
        .replace(/\b(?:drei|III|kolme|three|tre|tres)\b/uig, '3')
        .replace(/\b(?:four|fyra|IV|neljä|quat+ro|vier)\b/uig, '4')
        .replace(/\b(?:five|fünf|fyra|viisi|V)\b/uig, '5')
        .replace(/\b(?:kuusi|sechts|sex|six|VI)\b/uig, '6')
        .replace(/\b(and|ja|och|und)\b/uig, '&')
        // strip non-letters/numbers
        // - note: combined with decomposing unicode diacritics this normalizes both 'saa' and 'sää' as 'saa'
        // - we could precompose the Finnish letters back to avoid this
        // - see validator normalize-utf8-diacritics for details
        .replace(/[^\p{Letter}\p{Number}& ]/gu, '') // 2026-07-01: keep ' '. We need it for splitToBaseAndNumber()
        .replace(/\s+/ug, ' ')
        .replace(/ $/u, '')
        .replace(/^ /u, '')
        .toLowerCase();
    }

  },
  compare: (origA, origB) => {
    return compare2(origA, origB);

    function compare2(a, b) { // Added this wrapper function as I had issues with recursion

      const [aa, ab, an, ap] = a;
      const [ba, bb, bn, bp] = b;
      debugData(`COMPARE:\n['${aa}', '${ab}', '${an}', '${ap}'] VS\n['${ba}', '${bb}', '${bn}', '${bp}']`);

      const aFull = toFullTitle(a);
      const bFull = toFullTitle(b);

      // debugData(`JOINED COMPARE:\n  '${aFull}' vs  \n  '${bFull}'`);

      if (isEmpty(aa) || isEmpty(ba)) {
        return -1.0;
      }

      if (aFull === bFull) {
        return TITLE_MAX;
      }

      // MELKEHITYS-3496-ish: move part of $a to $n:
      const [altAa, altAn, altBa, altBn] = reconstructTitleAndNumber(aa, an, ba, bn);
      if (altAa) {
        return compare2([altAa, ab, altAn, ap], [altBa, bb, altBn, bp]);
      }

      if (ab && ab !== '' && ab === bb) { // Remove $b from equation (MELKEHITYS-3494)
        debug(`Ignore \$b ${ab}`);
        return compare2([aa, '', an, ap], [ba, '', bn, bp]);
      }
      if (an && an !== '' && an === bn) { // Remove $n from equation
        debug(`Ignore \$n ${an}`);
        return compare2([aa, ab, '', ap], [ba, bb, '', bp]);
      }
      if (ap && ap !== '' && ap === bp) { // Remove $p from equation
        debug(`Ignore \$p ${ap}`);
        return compare2([aa, ab, an, ''], [ba, bb, bn, '']);
      }
      // There seems to be wobble between $b and $p:
      if (!isEmpty(ab) && ab === bp) {
        return compare2([aa, '', an, ap], [ba, bb, bn, '']);
      }
      if (!isEmpty(ap) && ap === bp) {
        return compare2([aa, ab, an, ''], [ba, '', bn, bp]);
      }

      if (an && bn && an.match(/[0-9]/u)) {
        debug(`NUMBER FOUND. Compare ${an} and ${bn}`);
        const atmp = an.replace(/[^0-9]/ug, '');
        const btmp = bn.replace(/[^0-9]/ug, '');
        if (atmp === btmp) {
          debug(`Ignore \$n '${an}' vs '${bn}'`);
          return compare2([aa, ab, '', ap], [ba, bb, '', bp]);
        }
      }


      // f245$n information is critical; it can not mismatch at all  (exceptions have already been handled above):
      if (an && an !== bn) {
        return -1.0;
      }

      const [distance, maxLength, correctness] = doLevenshtein(aFull.replace(/ /ug, ''), bFull.replace(/ /ug, ''));

      debug(`'${aFull}' vs '${bFull}': Max length = ${maxLength}, distance = ${distance}, correctness = ${correctness}`);


      if (correctness >= threshold) {
        return TITLE_MAX * 0.8;
      }

      // Subset removal (MELKEHITYS-3498-ish)
      if (ab && bb) { // At this point ab and bb are never equal...
        // If X is a subset of Y, then remove X and shorten Y (= remove the shared content)
        if (ab.indexOf(bb) === 0) {
          return compare2([aa, ab.substring(bb.length), an, ap], [ba, '', bn, bp]);
        }
        if (bb.indexOf(ab) === 0) {
          return compare2([aa, '', an, ap], [ba, bb.substring(ab.length), bn, bp]);
        }
      }

      // Try the same without $p:
      if (localXor(ap, bp)) {
        const result = compare2([aa, ab, an, ''], [ba, bb, bn, '']);
        return result > 0.0 ? result * 0.8 : result;
      }

      if (aa === ba && an === bn) {
        const candScore = TITLE_MAX/2;
        // $b is missing from one:
        if (ap === bp && localXor(ab, bb)) {
          debug(`Handle omitted \$b using x ${candScore}`);
          return candScore;
        }
        if (ab === bb && localXor(ap, bp)) {
          debug(`Handle omitted \$p using x ${candScore}`);
          return candScore;
        }
      }

      if (an === bn && ap === bp ) {
        // $b-less $a is other record's $b, see MELKEHITYS-3485 for motivation (though we skip 246 and 490 here):
        const candScore = TITLE_MAX/2;
        if (aa === bb && !ab) {
          return candScore;
        }
        if (ba === ab && !bb) {
          return candScore;
        }
      }

      return -0.5; // Not likely
    }

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
      // No longer add space between subfields. Due to heavy normalization there are no spaces left in array elements either!
      return relevant.join('');
    }

    function getMaxLength(str1, str2) {
      return str1.length > str2.length ? str1.length : str2.length;
    }

    function reconstructTitleAndNumber(a1, n1, a2, n2) {
      if (!n1 && n2) {
        const [altA1, altN1] = splitToBaseAndNumber(a1);
        if (altN1) {
          debugData(`A: Reconstruct:\n $a '${a1}' =>\n $a '${altA1}' +\n $n '${altN1}`);
          return [altA1, altN1, a2, n2];
        }
      }
      if (n1 && !n2) {
        const [altA2, altN2] = splitToBaseAndNumber(a2);
        if (altN2) {
          debugData(`B: Reconstruct $a '${a2}' as $a '${altA2}' and $n '${altN2}`);
          return [a1, n1, altA2, altN2];
        }

      }
      return [null, null, null, null]; // Fail
    }


    function splitToBaseAndNumber(val) {
      const words = val.split(' ');
      const len = words.length;
      if (len < 2 || !words[len-1].match(/^[1-9][0-9]*$/)) {
        return [val, null];
      }
      if (len > 2 && words[len-2].match(/^(del|osa|vol|volume)$/u)) { // NB! "vol." has lost it's '.' during normalization!
        const number = `${words[len-2]} ${words[len-1]}`;
        return [words.slice(0, len-2).join(' '), number];
      }

      const number = words.pop();
      return [words.join(' '), number];
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
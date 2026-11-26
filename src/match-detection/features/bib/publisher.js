import createDebugLogger from 'debug';

import isSerial from './is-serial.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/publisher');

// Publisher name-set feature.
//
// Each record extracts a set of publisher names from:
//   260 $b; 264 $b (indicator 2 = 1, function: publisher, only);
//   710 (bare, no $e, OR $e a publisher role; never other-role $e; no stop-list);
//   110 (no publisher-likeness gate: all non-empty 110 values);
//   245 $c (bare, personal-name guard below)
// 710/110 extraction: the field is DISMISSED if it carries any $t or $k; else the
// name is the non-empty $a and $b subfields, all occurrences, strict subfield
// order, space-joined. No whole-field fallback.
//
// 550 is an open class (never parsed for names): if the OTHER record's extracted
// publisher name appears in this record's 550 text as a whole word-bounded
// phrase it yields the partial tier (+0.1) at most, either direction; 550 can
// never yield +0.2.
//
// Comparison:
//   either name set empty (and no 550 containment hit) -> 0 (skipped)
//   equal name sets after normalization -> +0.2
//   token-subset either direction (min 1 token) -> +0.1
//   550 containment hit -> +0.1 at most
//   else 0 (neutral, no penalty)
//
// Normalization: lowercase -> NFD diacritics stripped -> non-alphanumeric ->
// space -> whitespace collapse -> trailing corporate-suffix strip (repeated,
// whole tokens): oy oyj ab as ry rs osakeyhtio kustannusosakeyhtio kustannus
// ('media' is NOT stripped). A name stripped to empty is dropped.
//
// Subject to the pair-level seriality precondition (see is-serial.js).

// Publisher-role $e stems (julkaisija / kustantaja / utgivare)
const PUBROLE_E = /julkaisij|kustantaj|utgiv/iu;

// Trailing corporate suffixes, applied as whole tokens, repeated
const STRIP_SUFFIXES = new Set(['oy', 'oyj', 'ab', 'as', 'ry', 'rs', 'osakeyhtio', 'kustannusosakeyhtio', 'kustannus']);

export default () => ({
  name: 'Publisher',
  extract: ({record}) => {
    const names = extractNames(record);
    const result = {serial: isSerial(record), names, text550: extract550Text(record)};
    debug(`Extracted: ${JSON.stringify(result)}`);
    return result;
  },
  compare: (a, b) => {
    debug(`Comparing ${JSON.stringify(a)} to ${JSON.stringify(b)}`);

    // Seriality precondition: non-serial x non-serial pairs skip the feature
    if (!a.serial && !b.serial) {
      return 0;
    }

    const tier = compareNames(a.names, b.names);
    if (tier === 'exact') {
      return 0.2;
    }
    // 550 containment channel: either direction, partial tier at most
    if (tier === 'partial' || containsNamesIn550(a.names, b.text550) || containsNamesIn550(b.names, a.text550)) {
      return 0.1;
    }
    return 0;
  }
});

// Per-record publisher name set (normalized, deduped, sorted)
function extractNames(record) {
  const names = new Set();
  const add = (raw) => {
    const normalized = normalizeName(raw);
    if (normalized !== '') {
      names.add(normalized);
    }
  };

  // 260 $b (workhorse)
  for (const field of record.get(/^260$/u)) {
    for (const sf of field.subfields || []) {
      if (sf.code === 'b') add(sf.value);
    }
  }

  // 264 $b, function indicator (ind2) = 1 (publisher) only
  for (const field of record.get(/^264$/u)) {
    if (field.ind2 === '1') {
      for (const sf of field.subfields || []) {
        if (sf.code === 'b') add(sf.value);
      }
    }
  }

  // 710: dismissed on any $t/$k; else bare (no $e) or publisher-role $e only
  for (const field of record.get(/^710$/u)) {
    const subfields = field.subfields || [];
    if (subfields.some(sf => sf.code === 't' || sf.code === 'k')) continue;
    const eValues = subfields.filter(sf => sf.code === 'e').map(sf => String(sf.value)).join(' ');
    if (eValues.trim() !== '' && !PUBROLE_E.test(eValues)) continue;
    const name = roleName(subfields);
    if (name !== '') add(name);
  }

  // 110: no publisher-likeness gate; dismissed on any $t/$k
  for (const field of record.get(/^110$/u)) {
    const subfields = field.subfields || [];
    if (subfields.some(sf => sf.code === 't' || sf.code === 'k')) continue;
    const name = roleName(subfields);
    if (name !== '') add(name);
  }

  // 245 $c: included bare, personal-name-like values excluded
  for (const field of record.get(/^245$/u)) {
    for (const sf of field.subfields || []) {
      if (sf.code === 'c' && String(sf.value).trim() !== '' && !isPersonalNameLike(sf.value)) add(sf.value);
    }
  }

  return [...names].sort();
}

// Non-empty $a and $b subfields, all occurrences in this field, strict
// subfield order, space-joined. No whole-field fallback
function roleName(subfields) {
  return subfields
    .filter(sf => sf.code === 'a' || sf.code === 'b')
    .map(sf => String(sf.value).trim())
    .filter(value => value !== '')
    .join(' ');
}

// 245 $c personal-name guard: exclude when
// (a) 2-3 words, every word alphabetic (Finnish letters, '.' and '-' allowed),
//     every word starts uppercase, no ';' or ','
// (b) starts with a 'Firstname Lastname (toim...' editor pattern
// (c) ends '(toim.).' or '(toimittaja).'
function isPersonalNameLike(value) {
  const text = String(value).trim();
  const words = text.split(/\s+/u);
  if (words.length >= 2 && words.length <= 3
    && words.every(word => /^[A-ZÄÖÅa-zäöå.\-]+$/u.test(word))
    && words.every(word => /^[A-ZÄÖÅ]/u.test(word))
    && !/;|,/u.test(text)) {
    return true;
  }
  if (/^[A-ZÄÖÅ][a-zäöå]+ [A-ZÄÖÅ][a-zäöå]+\s*\(toim/iu.test(text)) {
    return true;
  }
  return /\(toim\.\)$|\(toimittaja\)\.$/iu.test(text);
}

// 550 text: all subfields of all 550 occurrences, lowercased, diacritics stripped,
// whitespace collapsed (no suffix/bracket stripping; single non-letter codes are
// not content). At comparison time normalize550Text brings the text to the
// same normalization as names (case, diacritics, non-alphanumerics -> space)
function extract550Text(record) {
  return record.get(/^550$/u)
    .flatMap(field => field.subfields || [])
    .filter(sf => /^[a-z]$/iu.test(String(sf.code)))
    .map(sf => String(sf.value))
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// Name normalization: lowercase -> NFD diacritics stripped ->
// non-alphanumeric -> space -> whitespace collapse -> trailing suffix strip
// (repeated, whole tokens). A name stripped to empty is dropped ('')
function normalizeName(raw) {
  const base = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (base === '') {
    return '';
  }
  const tokens = base.split(' ');
  while (tokens.length > 0 && STRIP_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}

// 'skip' (either set empty) | 'exact' | 'partial' | 'none'
function compareNames(namesA, namesB) {
  if (namesA.length === 0 || namesB.length === 0) {
    return 'skip';
  }
  if (namesA.length === namesB.length && namesA.every(name => namesB.includes(name))) {
    return 'exact';
  }
  // Token-subset, either direction, min 1 token (names are non-empty, so each
  // carries at least one token)
  const tokenSetsA = namesA.map(name => new Set(name.split(' ')));
  const tokenSetsB = namesB.map(name => new Set(name.split(' ')));
  for (const tokensA of tokenSetsA) {
    for (const tokensB of tokenSetsB) {
      if (isSubset(tokensA, tokensB) || isSubset(tokensB, tokensA)) {
        return 'partial';
      }
    }
  }
  return 'none';
}

function isSubset(tokens, other) {
  return [...tokens].every(token => other.has(token));
}

// Any of the (normalized) names appears in the 550 text as a whole phrase
// (word-bounded both ends, tokens contiguous). The text is run through the same
// normalization as extract550Text so matching stays symmetric even when the
// 550 text arrives unnormalized
function containsNamesIn550(names, text550) {
  const normalized = normalize550Text(text550);
  if (normalized === '' || names.length === 0) {
    return false;
  }
  return names.some(name => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'u').test(normalized));
}

// 550 text normalization: lowercase -> NFD diacritics stripped ->
// non-alphanumeric -> space -> whitespace collapse. Mirrors the per-step
// normalization of normalizeName (suffix stripping is name-only, since 550
// text is never parsed for names)
function normalize550Text(text550) {
  return String(text550)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

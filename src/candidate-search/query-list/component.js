import createDebugLogger from 'debug';
import {promisify} from 'util';
import {toQueries} from '../candidate-search-utils.js';
import {getSubfieldValues, stringAfter, stringBefore, testStringOrNumber, toMelindaIds} from '../../matching-utils.js';
import {fieldToString, uniqArray} from '@natlibfi/marc-record-validators-melinda/dist/utils.js';

const setTimeoutPromise = promisify(setTimeout); // eslint-disable-line

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:component');
const debugData = debug.extend('data'); // eslint-disable-line



export function parse773g(field) {
  const g = field?.subfields?.find(sf => sf.code === 'g'); // NB! returns the first $g

  if (!g) {
    return {};
  }

  const value = normalizeValue(g.value);

  return {
    // NB! We are not currently interested in volume (vuosikerta)
    year: gToYear(value) || null,
    number: gToNumber(value) || null,
    pages: gToPages(value) || null // Might also be eg. Raita 5. However, returns only the number part
  }

  function normalizeValue(value) {
    return value.replace(/(?:\. -|\.)$/u, '');
  }

  function gToNumber(value) {
    // Allow up to 3-digit numbers
    const extract1 = value.replace(/^.*: ([1-9][0-9]?[0-9]), (?:p\.|page|pp\.|s\.|Seite|sida|sidor|sivu).*$/ui, '$1');
    if (extract1 !== value) {
      return extract1;
    }
    return undefined;
  }

  function gToPages(value) {
    if (value.match(/^[0-9]+(?:-[0-9]+)?(?:, [0-9]+(?:-[0-9]+)?)*$/u)) {
      return value;
    }
    const numberPartOnly = value.replace(/^.*(?:p\.|raidat|raita|s\.|Seite|sivut?|pages?) /ui, '');
    if (numberPartOnly !== value) {
      return gToPages(numberPartOnly);
    }
    return undefined;
  }


  function gToYear(value) {
    debug(`EXTRACT YEAR FROM '${value}`);
    // extract year from within parentheses: $g vsk (yyyy) AND $g (YYYY)
    if (value.match(/^[1-9][0-9]?[0-9]? ?\((?:20[012][0-9]|19[0-9][0-9])\)/u) || value.match(/^\((?:20[012][0-9]|19[0-9][0-9])\)/u) ) {
      return stringBefore(stringAfter(value, '('), ')');
    }
    // If volume is missing, the year often seems qto come without them parentheses:
    if (value.match(/^(?:20[012][0-9]|19[0-9][0-9]) :/u)) {
      return stringBefore(value, ' ');
    }
    // Seen in SB $g (vsk)year joulukuu
    if (value.match(/^\([1-9][0-9]?\) ?(?:20[012][0-9]|19[0-9][0-9])[^0-9]/)) {
      return value.replace(/^\([0-9]+\) ?/u, '').replace(/[^0-9].*$/u, '');
    }
    // Some magazines use DD.MM.YYYY
    if (value.match(/^(?:[^0-9]*[1-9]|[12][0-9]|30|31)\.(?:1[012]|[1-9])\. ?(?:20[012][0-9]|19[0-9][0-9])[^0-9]/u)) {
      return value.replace(/^[^0-9]*[0-9]\.[0-9]\. ?/u, '').replace(/[^0-9].*$/u, '');
    }

    return undefined;
  }
}

export function extractPublicationYearFrom773(field) {
  const data = parse773g(field);
  debug(`Extracted year ${data.year} from f773$g ${fieldToString(field)}`);
  return data.year;
}

function isMelindaSubfieldW(subfield) {
  if (subfield.code !== 'w') {
    return false;
  }
  return (/^\((?:FI-MELINDA|FIN01)\)0[0-9]{8}$/ui).test(subfield.value);
}

function removeMelindaPrefixFromValue(value) {
  return value.replace(/^(?:\(FI-MELINDA\)|\(FIN01\))/, '');
}

export function getHostMelindaFields(record) {
  return record.get(/^773$/u).filter(f => f.subfields.some(sf => isMelindaSubfieldW(sf)));
}

export function extractHostMelindaIdsFromField(field) {
  return field.subfields.filter(sf => isMelindaSubfieldW(sf)).map(sf => removeMelindaPrefixFromValue(sf.value));
}

export function getHostMelindaIds(record) {
  return uniqArray(getHostMelindaFields(record).map(f => extractHostMelindaIdsFromField(f)).flat());
}

export function hostIdMelinda(record) { // old function with replaced code
  debug(`Creating query for the Melinda Id host`);
  const ids = getHostMelindaIds(record);
  if (ids.length === 0) {
    debug(`No valid Melinda Id host found`);
    return [];
  }
  return toQueries(getHostMelindaIds(record), 'melinda.partsofhost');
}

export async function hostIdOtherSource(record, client) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:hostIdOtherSource');
  const debugData = debug.extend('data'); // eslint-disable-line
  debug(`Creating query for the Other source Id host`);

  const ids = getHostIds(record);
  const otherSources = getOtherSources(record);
  if (ids.length > 0 && otherSources.length > 0) {
    const otherSourceIds = ids.map(id => otherSources.map(source => `${id}${source}`)).flat();
    const melindaHostQueries = await handleSruCalls(otherSourceIds);
    debug(JSON.stringify(melindaHostQueries));

    return melindaHostQueries;
  }

  debug(`No valid other source hosts found`);
  return [];


  function getHostIds(record) {
    const f773s = record.get(/^773$/u)
      .filter(f773 => f773.subfields.some(sub => sub.code === 'w' && !(/\(FI-MELINDA\).*/ui).test(sub.value)));
    if (f773s.length === 0) {
      return false;
    }

    // Multi 773 handling
    const subfieldWs = f773s
      .map(f773 => {
        debugData(`f773: ${JSON.stringify(f773)}`);
        return getSubfieldValues(f773, 'w').flat();
      }).flat();

    // Multi $w handling
    // $w (prefix)<id> handling
    // $w <id> & $w (prefix)<id> Match
    const ids = subfieldWs.map(value => `${value}`.replace(/\(FI-.*\)/ui, '')) // remove prefixes
      .filter(value => testStringOrNumber(value)) // drop invalid values
      .filter((value, index, array) => array.indexOf(value) === index); // unique values

    return ids;
  }

  function getOtherSources(record) {
    const fSids = record.get('SID');
    return fSids.map(field => getSubfieldValues(field, 'b'));
  }

  async function handleSruCalls(otherSourceIds, ids = []) {
    const [otherSourceId, ...rest] = otherSourceIds;

    if (otherSourceId === undefined) {
      debug(`host ids: ${ids}`);
      const validIds = ids.filter(id => id);
      return toQueries(validIds, 'melinda.partsofhost');
    }

    const otherSourceHostQuery = await toQueries([otherSourceId], 'melinda.sourceid');
    const id = await new Promise((resolve, reject) => {
      debug(`Searching for hosts with query: ${otherSourceHostQuery}`);
      let recordId;

      client.searchRetrieve(otherSourceHostQuery)
        .on('error', err => {
          debug(`SRU error for query: ${otherSourceHostQuery}: ${err}`);
          reject(err);
        })
        .on('end', async () => {
          try {
            debug(`Searching for hosts: done`);
            await setTimeoutPromise(10);
            resolve(recordId);
          } catch (err) {
            debug(`Error caught on END`);
            reject(err);
          }
        })
        .on('record', record => {
          const [field] = record.get(/^001$/u);
          debug(field);
          recordId = field.value ? field.value : '';
        });
    });

    return handleSruCalls(rest, [...ids, id]);
  }
}


import createDebugLogger from 'debug';
import {promisify} from 'util';
import {toQueries} from '../candidate-search-utils.js';
import {getSubfieldValues, testStringOrNumber, toMelindaIds} from '../../matching-utils.js';
import {normalizeIssnSubfieldValue} from '../../match-detection/features/bib/issn.js';
import {normalizeIsbn} from '../../match-detection/features/bib/isbn.js';

const setTimeoutPromise = promisify(setTimeout); // eslint-disable-line

const ISBN = 'z';
const ISSN = 'x';
const IDENTIFIER = 'o';

export function hostIdMelinda(record) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:hostIdMelinda');
  const debugData = debug.extend('data'); // eslint-disable-line
  debug(`Creating query for the Melinda Id host`);

  const ids = hostId(record);
  if (ids.length > 0) {
    return toQueries(ids, 'melinda.partsofhost');
  }

  debug(`No valid Melinda Id host found`);
  return [];

  function hostId(record) {
    // Multi 773 handling
    const f773s = getHostItemEntryFields(record)
      .filter(f773 => f773.subfields.some(sub => sub.code === 'w' && valueIsMelindaId(sub.value)));

    if (f773s.length === 0) {
      return false;
    }

    // Multi $w handling
    // $w (prefix)<id> handling
    // $w <id> & $w (prefix)<id> Match
    const melindaIds = f773s.map(f773 => toMelindaIds(f773, ['w'])).flat()
      .filter(value => testStringOrNumber(value)) // drop invalid values
      .filter((value, index, array) => array.indexOf(value) === index); // unique values;
    return melindaIds;
  }
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
    const f773s = getHostItemEntryFields(record)
      .filter(f773 => f773.subfields.some(sub => sub.code === 'w' && !valueIsMelindaId(sub.value))); // !(/^\(FI-MELINDA\).*/ui).test(sub.value)));
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

export function hostIssn(record) {
  return hostIdentifier(record, ISSN);
}

export function hostIsbn(record) {
  return hostIdentifier(record, ISBN);
}

export async function hostIdentifier(record, relevantSubfieldCode = IDENTIFIER) {
  const relevantFields = getHostItemEntryFields(record);
  const relevantSubfields = relevantFields.map(f => f.subfields).flat().filter(sf => sf.code === relevantSubfieldCode);

  const relevantIdentifiers = getRelevantIdentifiers();

  if (relevantValues.length === 0) {
    return [];
  }

  return await handleSruIdentifierCalls(relevantIdentifiers, []);


  function getRelevantIdentifiers() {
    if (relevantSubfieldCode === ISBN) {
      return relevantSubfields.map(sf => normalizeIsbn(sf.value));
    }
    if (relevantSubfieldCode == ISSN) {
      return relevantSubfields.map(sf => normalizeIssnSubfieldValue(sf.value));
    }
    return relevantSubfields.map(sf => sf.value);
  }

  function getSruSearchType() {
    if (relevantSubfieldCode === ISBN) {
      return 'index.bath.isbn';
    }
    if (relevantSubfieldCode === ISSN) {
      return 'index.bath.issn';
    }
    return 'whatever.whatever'; // 773$o not really supported
  }

  async function handleSruIdentifierCalls(identifiers, ids = []) {
    const [currIdentifier, ...remainingidentifiers] = identifiers;

    if (currIdentifier === undefined) {
      debug(`host ids: ${ids}`);
      const validIds = ids.filter(id => id);
      // TODO: this might return 1000s of comp... Should we include title?
      return toQueries(validIds, 'melinda.partsofhost');
    }

    const query = await toQueries([currIdentifier], getSruSearchType());
    const id = await new Promise((resolve, reject) => {
      debug(`Searching for hosts with query: ${otherSourceHostQuery}`);
      let recordId;

      client.searchRetrieve(query)
        .on('error', err => {
          debug(`SRU error for query: ${query}: ${err}`);
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
    return handleSruIdentifierCalls(remainingidentifiers, [...ids, id]);
  }

}

function getHostItemEntryFields(record) {
  return record.get(/^[79]73$/u);
}

function valueIsMelindaId(val) {
  return (/^\(FI-MELINDA\)0[0-9]{8}$/ui).test(val);
}
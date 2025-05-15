import createDebugLogger from 'debug';
import {promisify} from 'util';
import {toQueries} from '../candidate-search-utils';
import {getSubfieldValues, testStringOrNumber, toMelindaIds} from '../../matching-utils';

const setTimeoutPromise = promisify(setTimeout); // eslint-disable-line

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
    const f773s = record.get(/^773$/u)
      .filter(f773 => f773.subfields.some(sub => sub.code === 'w' && (/\(FI-MELINDA\).*/ui).test(sub.value)));

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
      // eslint-disable-next-line functional/no-let
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


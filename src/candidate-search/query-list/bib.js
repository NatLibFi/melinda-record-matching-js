import createDebugLogger from 'debug';
import {toQueries} from '../candidate-search-utils.js';
import {getMelindaIdsF035, validateSidFieldSubfieldCounts, getSubfieldValues, testStringOrNumber} from '../../matching-utils.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query');

export function bibSourceIds(record) {

  /* Melinda's SRU-index melinda.sourceid includes source IDs from SID fields in Melinda records
     SID-fields in Melinda have sf $c with local id and sf $b with a code for the local db:

     SID__ $c 123457 $b helka
     SID__ $c (ANDL100020)1077305 $b sata
     SID__ $c VER999999 $ FI-KV
     SID__ $c /10024/508126 $ REPO_THESEUS

    In melinda.sourceid -index case is kept, sourceprefixes in brackets and hyphens are normalized away:
    Note: slashes are not normalized away, but a SRU-search-string including slashes needs to be quoted

    1234567helka
    1077305sata
    VER999999FIKV
    /10024/508126REPO_THESEUS

    Note: All Melinda records that have a matching records in a local db do NOT have SID for that local records,
          existence of a SID field depends on how the record has been added to Melinda and how it has been handled
          afterwards. SIDs are also not reliably maintained. A record might or might not have a SID for a local db
          after the matching record is removed from the local db.

   */


  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:source-ids');
  const debugData = debug.extend('data');
  //const debugInfo = debug.extend('info');

  debug(`Creating queries for sourceid's`);

  const fSids = record.get('SID');
  debugData(`SID-fields (${fSids.length}): ${JSON.stringify(fSids)}`);

  return fSids.length > 0 ? toSidQueries(fSids) : [];

  function toSidQueries(fSids) {
    debug(`Creating actual queries for sourceid's`);

    const sidStrings = getSidStrings(fSids);

    if (sidStrings.length < 1) {
      debug(`No identifiers found, no queries created.`);
      return [];
    }

    const sidQueries = toQueries(sidStrings, 'melinda.sourceid');

    return sidQueries;

    function getSidStrings(fSids) {
      debug(`Getting Sid strings from SID fields`);

      // Map SID fields to valid sidStrings, filter out empty strings
      const sidStrings = fSids.map(toSidString).filter(nonEmptySid => nonEmptySid);
      return sidStrings;

      function toSidString(field) {
        debug(`Getting string from a field`);

        return validateSidFieldSubfieldCounts(field) ? createSidString(field) : '';

        function createSidString(field) {
          debug(`Creating string from a field`);
          const [sfC] = getSubfieldValues(field, 'c');
          const [sfB] = getSubfieldValues(field, 'b');

          const cleanedSfC = removeSourcePrefix(normalizeSidSubfieldValue(sfC));
          const cleanedSfB = normalizeSidSubfieldValue(sfB);

          debugData(`${JSON.stringify(sfC)} + ${JSON.stringify(sfB)}`);
          return cleanedSfC.concat(cleanedSfB);
        }

        function removeSourcePrefix(subfieldValue) {
          const sourcePrefixRegex = (/^(?<sourcePrefix>\([A-Za-z0-9-]+\))(?<id>.+)$/u);
          const normalizedValue = testStringOrNumber(subfieldValue) ? String(subfieldValue).replace(sourcePrefixRegex, '$<id>') : '';
          debugData(`Normalized ${subfieldValue} to ${normalizedValue}`);
          return normalizedValue;
        }

        function normalizeSidSubfieldValue(subfieldValue) {
          debugData(`Normalizing ${subfieldValue}`);
          const normalizeAwayRegex = (/[- ]/u);
          return testStringOrNumber(subfieldValue) ? String(subfieldValue).replace(normalizeAwayRegex, '') : '';
        }

      }
    }
  }
}

export function bibMelindaIds(record) {
  // Melinda's SRU-index melinda.melindaid includes f001 controlnumbers and old Melinda-IDs from f035z's for all non-deleted Melinda-records

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibMelindaIds');
  const debugData = debug.extend('data');
  debug(`Creating queries for MelindaIds`);

  // Note: Melinda-ID's for search queries are created just from records f035a's and f035z's
  // Both (FI-MELINDA)- and FCC-prefixed forms are found
  // f001 controlnumber is not currently included, even if record's f003 is FI-MELINDA
  const melindaIds = getMelindaIdsF035(record);

  debugData(`Unique identifiers (${melindaIds.length}): ${JSON.stringify(melindaIds)}`);

  if (melindaIds.length < 1) {
    debug(`No identifiers found, no queries created.`);
    return [];
  }

  return toQueries(melindaIds, 'melinda.melindaid');
}


// bibHostComponents returns host id from the first subfield $w of first field f773, see test-fixtures 04 and 05
// bibHostComponents should search all 773 $ws for possible host id, but what should it do in case of multiple host ids?
export function bibHostComponents(record) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibHostComponents');
  const debugData = debug.extend('data');
  debug(`Creating queries for hostIds`);

  const id = getHostId();
  debugData(`Found id: ${JSON.stringify(id)}`);

  return testStringOrNumber(id) ? [`melinda.partsofhost=${id}`] : [];

  function getHostId() {
    const [field] = record.get(/^773$/u);

    if (field) {
      const {value} = field.subfields.find(({code}) => code === 'w') || {};

      if (testStringOrNumber(value) && (/^\(FI-MELINDA\)/u).test(String(value))) {
        return String(value).replace(/^\(FI-MELINDA\)/u, '');
      }

      if (testStringOrNumber(value) && (/^\(FIN01\)/u).test(String(value))) {
        return String(value).replace(/^\(FIN01\)/u, '');
      }

      return false;
    }
    return false;
  }
}

// SRU search dc.title with a search phrase starting with ^ maps currently in Melinda to
// (probably) to *headings* index TIT
// - Aleph cannot currently handle headings searches starting with a boolean - in these cases use word search

// Headings index TIT drops articles etc. from the start of the title according to the filing indicator
// Currently filing indicator is not implemented - if the title starts with an article and the Melinda
// record is correctly catalogued using a filing indicator -> dc.title search won't match

export function bibTitle(record) {
  // We get author/publisher only when formatted title is shorter than 5 chars
  return bibTitleAuthorPublisher({record, onlyTitleLength: 5});
}

export function bibTitleAuthor(record) {
  debug('bibTitleAuthor');
  // We use onlyTitleLength that is longer than our formatted length to
  // get an author or an publisher always
  return bibTitleAuthorPublisher({record, onlyTitleLength: 100});
}

export function bibTitleAuthorYear(record) {
  debug('bibTitleAuthorYearAlternates');
  // We use onlyTitleLength that is longer than our formatted length to
  // get an author or an publisher always

  return bibTitleAuthorPublisher({record, onlyTitleLength: 100, addYear: true});
}

export function bibTitleAuthorYearAlternates(record) {
  debug('bibTitleAuthorYearAlternates');
  // We use onlyTitleLength that is longer than our formatted length to
  // get an author or an publisher always
  const origQueryList = bibTitleAuthorPublisher({record, onlyTitleLength: 100, addYear: true, alternates: true, alternateQueries: []});
  debug(`${JSON.stringify(origQueryList)}`);
  return {queryList: Array.from(origQueryList).reverse(), queryListType: 'alternates'};
}

export function bibTitleAuthorPublisher({record, onlyTitleLength, addYear = false, alternates = false, alternateQueries = []}) {
  debug(`bibTitleAuthorPublisher, onlyTitleLength: ${onlyTitleLength}, addYear: ${addYear}, alternates: ${alternates}`);
  const title = getTitle();
  if (testStringOrNumber(title)) {
    const formatted = String(title)
      .replace(/[^\w\s\p{Alphabetic}]/gu, '')
      // Clean up concurrent spaces from fe. subfield changes
      .replace(/ +/gu, ' ')
      .trim()
      .slice(0, 30)
      .trim();

    // use word search for titles starting with a boolean
    const useWordSearch = checkUseWordSearch(formatted);
    // Prevent too many matches / SRU crashing by having a minimum length
    // Note that currently this fails matching if there are no matches from previous matchers
    if (formatted.length >= onlyTitleLength && !alternates) {
      return [`dc.title="${useWordSearch ? '' : '^'}${formatted}*"`];
    }
    const queryIsOkAlone = formatted.length >= 5;

    // use word search without ending * also in combination searches to avoid SRU-server crashes [MRA-189]
    const query = `dc.title="${useWordSearch || !queryIsOkAlone ? '' : '^'}${formatted}${queryIsOkAlone ? '*' : ''}"`;
    debug(`query: ${query}`);
    const newAlternateQueries = alternates ? [...alternateQueries, query] : alternateQueries;

    return addAuthorsToSearch({query, queryIsOkAlone, addYear, alternates, alternateQueries: newAlternateQueries});
  }

  return [];

  function addAuthorsToSearch({query, queryIsOkAlone = false, addYear = false, alternates = false, alternateQueries = []}) {
    debug('addAuthorsToSearch');
    const [authorQuery] = bibAuthors(record);
    if (authorQuery !== undefined) {
      if (addYear) {
        const newAlternateQueries = alternates ? [...alternateQueries, `${authorQuery} AND ${query}`] : alternateQueries;
        return addYearToSearch({query: `${authorQuery} AND ${query}`, queryIsOkAlone: true, alternates, alternateQueries: newAlternateQueries});
      }
      return alternates ? alternateQueries : [`${authorQuery} AND ${query}`];
    }
    return addPublisherToSearch({query, queryIsOkAlone, addYear, alternates, alternateQueries});
    //return [];
  }

  function addPublisherToSearch({query, queryIsOkAlone = false, addYear = false, alternates = false, alternateQueries = []}) {
    const [publisherQuery] = bibPublishers(record);
    if (publisherQuery !== undefined) {
      if (addYear) {
        const newAlternateQueries = alternates ? [...alternateQueries, `${publisherQuery} AND ${query}`] : alternateQueries;
        return addYearToSearch({query: `${publisherQuery} AND ${query}`, queryIsOkAlone: true, alternates, alternateQueries: newAlternateQueries});
      }
      return alternates ? alternateQueries : [`${publisherQuery} AND ${query}`];
    }
    if (queryIsOkAlone && !addYear) {
      return alternates ? alternateQueries : [`${query}`];
    }
    return addYearToSearch({query, queryIsOkAlone, alternates, alternateQueries});
  }

  function addYearToSearch({query, queryIsOkAlone = false, alternates = false, alternateQueries = []}) {
    const [yearQuery] = bibYear(record);
    if (yearQuery !== undefined) {
      const newAlternateQueries = alternates ? [...alternateQueries, `${yearQuery} AND ${query}`] : alternateQueries;
      return alternates ? newAlternateQueries : [`${yearQuery} AND ${query}`];
    }
    if (queryIsOkAlone) {
      return alternates ? alternateQueries : [`${query}`];
    }
    return [];
  }

  function getTitle() {
    const [field] = record.get(/^245$/u);

    if (field) {
      const titleString = field.subfields
        //.filter(({code}) => ['a', 'b', 'n', 'p'].includes(code))
        .filter(({code}) => ['a', 'b'].includes(code))
        //.filter(({code}) => ['a'].includes(code))
        .map(({value}) => testStringOrNumber(value) ? String(value) : '')
        .filter(value => value)
        // In Melinda's index subfield separators are indexed as ' '
        .join(' ');
      return titleString;
    }
    return false;
  }
}

export function bibAuthors(record) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibAuthors');
  const debugData = debug.extend('data');
  debug(`Creating query for the first author`);
  //debugData(record);

  const author = getAuthor(record);

  if (testStringOrNumber(author)) {
    const formatted = String(author)
      .replace(/[^\w\s\p{Alphabetic}]/gu, '')
      // Clean up concurrent spaces from fe. subfield changes
      .replace(/ +/gu, ' ')
      .trim()
      .slice(0, 30)
      .trim();

    // use word search for authors starting with a boolean
    const useWordSearch = checkUseWordSearch(formatted);
    // Prevent too many matches by having a minimum length
    debugData(`Author string: ${formatted}`);
    if (formatted.length >= 5) {
      return [`dc.author="${useWordSearch ? '' : '^'}${formatted}*"`];
    }
    return [];
  }

  return [];

  function getAuthor(record) {
    //debugData(record);
    // eslint-disable-next-line prefer-named-capture-group
    const [field] = record.get(/^(100)|(110)|(111)|(700)|(710)|(711)$/u);
    //debugData(field);

    if (field) {
      const authorString = field.subfields
        .filter(({code}) => ['a'].includes(code))
        .map(({value}) => testStringOrNumber(value) ? String(value) : '')
        .filter(value => value)
        // In Melinda's index subfield separators are indexed as ' '
        .join(' ');
      return authorString;
    }
    return false;
  }
}

export function bibPublishers(record) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibPublishers');
  const debugData = debug.extend('data');
  debug(`Creating query for the first publisher`);
  //debugData(record);

  const publisher = getPublisher(record);
  if (testStringOrNumber(publisher)) {
    const formatted = String(publisher)
      .replace(/[^\w\s\p{Alphabetic}]/gu, '')
      // Clean up concurrent spaces from fe. subfield changes
      .replace(/ +/gu, ' ')
      .trim()
      .slice(0, 30)
      .trim();

    debugData(`Publisher string: ${formatted}`);
    // use non-wildcard word search from dc.publisher
    return [`dc.publisher="${formatted}"`];
  }

  return [];

  function getPublisher(record) {
    //debugData(record);
    const [field] = record.get(/^(?:260)|(?:264)$/u);
    //debugData(field);

    if (field) {
      const publisherString = field.subfields
        .filter(({code}) => ['b'].includes(code))
        .map(({value}) => testStringOrNumber(value) ? String(value) : '')
        .filter(value => value)
        // In Melinda's index subfield separators are indexed as ' '
        .join(' ');
      return publisherString;
    }
    return false;
  }
}

export function bibYear(record) {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibYear');
  const debugData = debug.extend('data');
  debug(`Creating query for the publishing year`);

  const year = getYear(record);
  if (year) {
    return [`dc.date="${year}"`];
  }
  return [];

  function getYear(record) {
    const [f008] = record.get(/^008$/u);
    if (f008 === undefined) {
      debug('f008 missing');
      return false;
    }

    debugData(`f008: ${JSON.stringify(f008)}`);
    const {value} = f008;
    return testStringOrNumber(value) ? String(value).slice(7, 11) : undefined;
  }
}

export function checkUseWordSearch(formatted) {
  // Note: add a space to startWords to catch just actual boolean words
  const booleanStartWords = ['and ', 'or ', 'nor ', 'not '];
  return booleanStartWords.some(word => formatted.toLowerCase().startsWith(word));
}

export function bibStandardIdentifiers(record) {

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query:bibStandardIdentifiers');
  const debugData = debug.extend('data');
  debug(`Creating queries for standard identifiers`);

  // DEVELOP: should we query also f015 and f028?

  const fields = record.get(/^(?<def>020|022|024)$/u);
  const identifiers = [].concat(...fields.map(toIdentifiers));
  const uniqueIdentifiers = [...new Set(identifiers)];

  debugData(`Standard identifier fields: ${JSON.stringify(fields)}`);
  debugData(`Identifiers (${identifiers.length}): ${JSON.stringify(identifiers)}`);
  debugData(`Unique identifiers (${uniqueIdentifiers.length}): ${JSON.stringify(uniqueIdentifiers)}`);

  if (uniqueIdentifiers.length < 1) {
    debug(`No identifiers found, no queries created.`);
    return [];
  }

  return toQueries(uniqueIdentifiers, 'dc.identifier');

  function toIdentifiers({tag, subfields}) {
    const issnIsbnReqExp = (/^[A-Za-z0-9-]+$/u);
    const otherIdReqExp = (/^[A-Za-z0-9-:]+$/u);

    if (tag === '022') {
      return subfields
        .filter(sub => ['a', 'z', 'y'].includes(sub.code) && testStringOrNumber(sub.value) && issnIsbnReqExp.test(String(sub.value)))
        .map(({value}) => String(value));
    }

    if (tag === '020') {
      return subfields
        .filter(sub => ['a', 'z'].includes(sub.code) && testStringOrNumber(sub.value) && issnIsbnReqExp.test(String(sub.value)))
        .map(({value}) => String(value));
    }

    return subfields
      .filter(sub => ['a', 'z'].includes(sub.code) && testStringOrNumber(sub.value) && otherIdReqExp.test(String(sub.value)))
      .map(({value}) => String(value));
  }
}

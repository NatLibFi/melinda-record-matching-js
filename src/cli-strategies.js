import {matchDetection} from './index.js';

// The mirrored strategies (IDS, STANDARD_IDS, CONTENT, CONTENTALT) must keep the exact same
// feature set, order and options as the validator's strategies (melinda-rest-api-validator)
const allowedSearchTypes = [
  'IDS',
  'IDS_F773',
  'STANDARD_IDS',
  'STANDARD_IDS_F773',
  'COMPONENT',
  'CONTENT',
  'CONTENTALT',
  'CONTENT_F773',
  'CONTENTALT_F773',
  'YSO'
];

// The issn() factory throws on non-finite or negative positiveWeight values,
// so a malformed ISSN_POSITIVE_WEIGHT env value fails loudly at strategy generation
const defaultIssnPositiveWeight = 0.75;

export {allowedSearchTypes};

export default function generateStrategy(searchType) {
  if (['IDS'].includes(searchType)) {
    return [
      matchDetection.features.bib.melindaId(),
      matchDetection.features.bib.allSourceIds()
    ];
  }

  if (['IDS_F773'].includes(searchType)) {
    return [
      matchDetection.features.bib.melindaId(),
      matchDetection.features.bib.allSourceIds(),
      matchDetection.features.bib.f773() // Host data
    ];
  }

  // We could have differing strategy for STANDARD_IDS
  // Let's not run title in strategy when we found the candidates through standard_ids search
  if (['STANDARD_IDS'].includes(searchType)) {
    return getStandardIdsStrategy();
  }

  if (['STANDARD_IDS_F773'].includes(searchType)) {
    return [
      ...getStandardIdsStrategy(),
      matchDetection.features.bib.f773() // Host data
    ];
  }

  if (['COMPONENT'].includes(searchType)) {
    return [
      matchDetection.features.bib.hostComponent(),
      matchDetection.features.bib.otherStandardIdentifier(),
      matchDetection.features.bib.recordType(),
      matchDetection.features.bib.title(),
      matchDetection.features.bib.language(),
      matchDetection.features.bib.authors(),
      matchDetection.features.bib.bibliographicLevel(),
      matchDetection.features.bib.f773() // Host data
    ];
  }

  if (['CONTENT', 'CONTENTALT'].includes(searchType)) {
    return getContentStrategy();
  }

  if (['CONTENT_F773', 'CONTENTALT_F773'].includes(searchType)) {
    return [
      ...getContentStrategy(),
      matchDetection.features.bib.f773() // Host data
    ];
  }

  if (['YSO']) {
    return [
      // matchDetection.features.bib.sid(), // SIDs might be relevant on the auth side as well?
      matchDetection.features.auth.yso()
    ];
  }

  throw new Error('Unsupported match validation package');
}

// Mirrors the validator's STANDARD_IDS strategy exactly (feature set, order and options);
// the issn() positiveWeight is taken from the ISSN_POSITIVE_WEIGHT env variable
function getStandardIdsStrategy() {
  return [
    matchDetection.features.bib.hostComponent(),
    matchDetection.features.bib.isbn(),
    matchDetection.features.bib.setVolumeLevel(),
    matchDetection.features.bib.issn({positiveWeight: getIssnPositiveWeight()}),
    matchDetection.features.bib.publisher(),
    matchDetection.features.bib.f338(),
    matchDetection.features.bib.serialLevel(),
    matchDetection.features.bib.publisherNumber(),
    matchDetection.features.bib.otherStandardIdentifier(),
    // Let's not use the same title matchDetection here
    //matchDetection.features.bib.title(),
    matchDetection.features.bib.authors(),
    // We probably should have some leeway here for notated music as BK etc.
    matchDetection.features.bib.recordType(),
    // Use publicationTimeAllowConsYearsMulti to
    //  - ignore one year differences in publicationTime
    //  - extract publicationTimes from f008, f26x and reprint notes in f500
    //  - do not substract points for mismatching (normal) publicationTime, if there's a match between
    //       normal publicationTime and a reprintPublicationTime
    //  - do not subract points for mismatchin (normal) publiscationTime if there's a match between
    //       normal publicationTime and a copyrightPublicationTime
    matchDetection.features.bib.publicationTimeAllowConsYearsMulti(),
    matchDetection.features.bib.language(),
    matchDetection.features.bib.bibliographicLevel()
  ];
}

// Mirrors the validator's CONTENT/CONTENTALT strategy exactly
function getContentStrategy() {
  return [
    matchDetection.features.bib.hostComponent(),
    matchDetection.features.bib.isbn(),
    matchDetection.features.bib.issn(),
    matchDetection.features.bib.publisherNumber(),
    // matchDetection.features.bib.sid(),
    matchDetection.features.bib.otherStandardIdentifier(),
    matchDetection.features.bib.title(),
    matchDetection.features.bib.authors(),
    matchDetection.features.bib.recordType(),
    matchDetection.features.bib.publicationTime(),
    matchDetection.features.bib.language(),
    matchDetection.features.bib.bibliographicLevel()
  ];
}

// A set-but-empty ISSN_POSITIVE_WEIGHT counts as unset (falls back to the
// default); an explicit '0' is a valid value meaning "disable the weight"
function getIssnPositiveWeight() {
  const raw = process.env.ISSN_POSITIVE_WEIGHT;
  return raw === undefined || raw === '' ? defaultIssnPositiveWeight : Number(raw);
}



import * as bib from './bib';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:index');
const debugData = debug.extend('data');

export const searchTypes = {
  bib: {
    standardIdentifiers: 'bibStandardIdentifiers',
    hostComponents: 'bibHostComponents',
    title: 'bibTitle', // title ( + first author + first publisher if needed)
    titleAuthor: 'bibTitleAuthor', // title + first author (or first publisher if no author)
    titleAuthorYear: 'bibTitleAuthorYear', // title + first author (or first publisher if no author), publishing year
    titleAuthorYearAlternates: 'bibTitleAuthorYearAlternates', // title + first author (or first publisher if no author), publishing year
    melindaId: 'bibMelindaIds',
    sourceIds: 'bibSourceIds'
    //DEVELOP: bibContent: 'bibContent'
  }
};

export default (record, searchSpec) => {
  const extractors = {...bib};
  debugData(`extractors: ${JSON.stringify(extractors)}`);
  debugData(`searchSpec: ${JSON.stringify(searchSpec)}`);

  return searchSpec
    .map(generateQueryExtractor)
    .map(cb => cb(record))
    .flat();

  function generateQueryExtractor(type) {
    if (extractors[type]) {
      //debugData(`${JSON.stringify(extractors[type])}`);
      return extractors[type];
    }

    throw new Error(`Unknown search type: ${type}`);
  }
};

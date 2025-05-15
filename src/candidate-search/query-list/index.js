import * as bib from './bib';
import * as component from './component';
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
  },
  component: {
    hostIdMelinda: 'hostIdMelinda', // 773 $w (FI-MELINDA)
    hostIdOtherSource: 'hostIdOtherSource', // 773 $w !(FI-MELINDA)
    hostIsbn: 'hostIsbn' // 773 $z
  }
};

export default async (record, searchSpec, client) => {
  const extractors = {...bib, ...component};
  debugData(`extractors: ${JSON.stringify(extractors)}`);
  debugData(`searchSpec: ${JSON.stringify(searchSpec)}`);

  const qExtractors = searchSpec.map(generateQueryExtractor);
  const results = await handleQextractors(qExtractors);
  return results;

  async function handleQextractors(qExtractors, results = []) {
    const [qExtractor, ...rest] = qExtractors;

    if (qExtractor === undefined) {
      return results.flat();
    }

    const result = await qExtractor(record, client);
    return handleQextractors(rest, [...results, result]);
  }

  function generateQueryExtractor(type) {
    if (extractors[type]) {
      //debugData(`${JSON.stringify(extractors[type])}`);
      return extractors[type];
    }

    throw new Error(`Unknown search type: ${type}`);
  }
};

import fs from 'fs';
import yargs from 'yargs';
import createMatchOperator, {candidateSearch, matchDetection} from './index.js';
import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';

cli();

async function cli() {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:cli');
  const args = yargs(process.argv.slice(2))
    .scriptName('melinda-record-matching-js')
    .epilog('Copyright (C) 2022-2023 University Of Helsinki (The National Library Of Finland)')
    .usage('$0 <file> [options] and env variable info in README')
    .usage('Installed globally: $0 <operation> [options] and env variable info in README')
    .usage('Not installed: npx $0 <operation> [options] and env variable info in README')
    .usage('Build from source: node dist/index.js <operation> [options] and env variable info in README')
    .showHelpOnFail(true)
    .example([['$ node /dist/cli.js record.json']])
    .env('MELINDA_RECORD_MATCH')
    .version()
    .positional('file', {type: 'string', describe: 'Json file of records to match'})
    .options({
      t: {type: 'string', default: 'IDS', alias: 'searchType', describe: 'IDS, STANDARD_IDS, COMPONENT, CONTENT or CONTENTALT'},
      m: {type: 'number', default: 1, alias: 'maxMatches', describe: ''},
      c: {type: 'number', default: 1000, alias: 'maxCandidates', describe: ''},
      s: {type: 'boolean', default: false, alias: 'returnStrategy', describe: ''},
      q: {type: 'boolean', default: false, alias: 'returnQuery', describe: ''},
      n: {type: 'boolean', default: false, alias: 'returnNonMatches', describe: ''}
    })
    .check((args) => {
      const [file] = args._;
      if (file === undefined) {
        throw new Error('No file argument given');
      }

      if (!fs.existsSync(file)) {
        throw new Error(`File ${file} does not exist`);
      }

      if (args.sruUrl === undefined) {
        throw new Error('Setup sru url');
      }

      if (!['IDS', 'STANDARD_IDS', 'COMPONENT', 'CONTENT', 'CONTENTALT'].includes(args.searchType)) {
        throw new Error('Invalid search type');
      }

      return true;
    })
    .parseSync();

  const [file] = args._;
  const {searchType} = args;
  debug(JSON.stringify(args));

  const detection = {
    treshold: 0.9,
    strategy: generateStrategy(searchType)
  };

  const search = {
    url: args.sruUrl, searchSpec: generateSearchSpec(searchType)
  };

  const matchOperator = await createMatchOperator({detection, search, ...args});

  const fileRaw = fs.readFileSync(file, 'utf8');
  const record = new MarcRecord(JSON.parse(fileRaw), {subfieldValues: false});

  const result = await matchOperator({record});
  debug(JSON.stringify(result));


  function generateStrategy(searchType) {
    if (['IDS'].includes(searchType)) {
      return [
        matchDetection.features.bib.melindaId(),
        matchDetection.features.bib.allSourceIds()
      ];
    }

    // We could have differing strategy for STANDARD_IDS
    // Let's not run title in strategy when we found the candidates through standard_ids search

    if (['STANDARD_IDS'].includes(searchType)) {
      return [
        matchDetection.features.bib.hostComponent(),
        matchDetection.features.bib.isbn(),
        matchDetection.features.bib.issn(),
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
        //       normal publicationTime and a reprintPublication time
        matchDetection.features.bib.publicationTimeAllowConsYearsMulti(),
        matchDetection.features.bib.language(),
        matchDetection.features.bib.bibliographicLevel()
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
        matchDetection.features.bib.bibliographicLevel()
      ];
    }

    if (['CONTENT', 'CONTENTALT'].includes(searchType)) {
      return [
        matchDetection.features.bib.hostComponent(),
        matchDetection.features.bib.isbn(),
        matchDetection.features.bib.issn(),
        matchDetection.features.bib.otherStandardIdentifier(),
        matchDetection.features.bib.title(),
        matchDetection.features.bib.authors(),
        matchDetection.features.bib.recordType(),
        matchDetection.features.bib.publicationTime(),
        matchDetection.features.bib.language(),
        matchDetection.features.bib.bibliographicLevel()
      ];
    }

    throw new Error('Unsupported match validation package');
  }


  function generateSearchSpec(searchType) {
    if (['IDS'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.melindaId,
        candidateSearch.searchTypes.bib.sourceIds
      ];
    }

    if (['STANDARD_IDS'].includes(searchType)) {
      return [candidateSearch.searchTypes.bib.standardIdentifiers];
    }

    if (['COMPONENT'].includes(searchType)) {
      return [
        //candidateSearch.searchTypes.bib.sourceIds,
        candidateSearch.searchTypes.component.hostIdMelinda,
        candidateSearch.searchTypes.component.hostIdOtherSource
      ];
    }

    if (['CONTENT'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.hostComponents,
        //candidateSearch.searchTypes.bib.titleAuthor,
        candidateSearch.searchTypes.bib.title
      ];
    }
    if (['CONTENTALT'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.hostComponents,
        // titleAuthorYearAlternates searches for matchCandidates
        // with alternate queries, starting from more tight searches
        candidateSearch.searchTypes.bib.titleAuthorYearAlternates
      ];
    }

    throw new Error('Unsupported match validation package');
  }
}

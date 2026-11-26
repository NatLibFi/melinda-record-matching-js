import fs from 'fs';
import yargs from 'yargs';
import createMatchOperator, {candidateSearch} from './index.js';
import generateStrategy, {allowedSearchTypes} from './cli-strategies.js';
import createDebugLogger from 'debug';
import {MarcRecord} from '@natlibfi/marc-record';
import {uniqArray} from '@natlibfi/marc-record-validators-melinda/dist/utils.js';

cli();

// eslint-disable-next-line max-lines-per-function
async function cli() {
  const debug = createDebugLogger('@natlibfi/melinda-record-matching:cli');
  const args = yargs(process.argv.slice(2))
    .scriptName('melinda-record-matching-js')
    .epilog('Copyright (C) 2022-2023 University Of Helsinki (The National Library Of Finland)')
    .usage('$0 <file> [options] and env variable info in README')
    .usage('Installed globally: $0 <file> [options] and env variable info in README')
    .usage('Not installed: npx $0 <file> [options] and env variable info in README')
    .usage('Build from source: node dist/index.js <file> [options] and env variable info in README')
    .showHelpOnFail(true)
    .example([['$ node /dist/cli.js record.json']])
    .env('MELINDA_RECORD_MATCH')
    .version()
    .positional('file', {type: 'string', describe: 'Json file of records to match'})
    .options({
      t: {
        type: 'string',
        default: 'IDS',
        alias: 'searchType',
        describe: 'IDS, IDS_F773, STANDARD_IDS(_F773), COMPONENT, CONTENT(_F773), CONTENTALT(_F773) or YSO'
      },
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

      if (!allowedSearchTypes.includes(args.searchType)) {
        throw new Error('Invalid search type');
      }

      return true;
    })
    .parseSync();

  const [file] = args._;
  const {searchType} = args;
  debug(JSON.stringify(args));

  const detection = {
    threshold: 0.8999,
    strategy: generateStrategy(searchType)
  };

  const search = {
    url: args.sruUrl, searchSpec: generateSearchSpec(searchType)
  };

  const matchOperator = await createMatchOperator({detection, search, ...args});

  const fileRaw = fs.readFileSync(file, 'utf8');
  const record = new MarcRecord(JSON.parse(fileRaw), {subfieldValues: false});

  const result = await matchOperator({record});
  const matchCount = result.matches.length;
  const matchIds = result.matches.map(matchA => matchA.candidate.id);
  const nonMatchCount = result.nonMatches?.length || result.nonMatchCount;
  const nonMatchIds = result.nonMatches?.map(matchA => matchA.candidate.id) || [];
  const uniqueNonMatchIds = uniqArray(nonMatchIds);
  const uniqueNonMatchCount = uniqueNonMatchIds.length;
  const candidateCount = result.candidateCount;

  debug(`Matches (${matchCount}) ${JSON.stringify(matchIds)}`);
  debug(`NonMatches (${nonMatchCount}) ${JSON.stringify(nonMatchIds)}`);
  debug(`Unique nonMatches (${uniqueNonMatchCount}) ${JSON.stringify(uniqueNonMatchIds)}`);
  debug(`Candidates (${candidateCount})`);

  debug(JSON.stringify(result));

  // DEVELOP: print results to output file

  function generateSearchSpec(searchType) {
    if (['IDS', 'IDS_F773'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.melindaId,
        candidateSearch.searchTypes.bib.sourceIds
      ];
    }

    if (['STANDARD_IDS', 'STANDARD_IDS_F773'].includes(searchType)) {
      return [candidateSearch.searchTypes.bib.standardIdentifiers];
    }

    if (['COMPONENT'].includes(searchType)) {
      return [
        //candidateSearch.searchTypes.bib.sourceIds,
        candidateSearch.searchTypes.component.hostIdMelinda,
        candidateSearch.searchTypes.component.hostIdOtherSource
      ];
    }

    if (['CONTENT', 'CONTENT_F773'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.hostComponents,
        //candidateSearch.searchTypes.bib.titleAuthor,
        candidateSearch.searchTypes.bib.title
      ];
    }
    if (['CONTENTALT', 'CONTENTALT_F773'].includes(searchType)) {
      return [
        candidateSearch.searchTypes.bib.hostComponents,
        // titleAuthorYearAlternates searches for matchCandidates
        // with alternate queries, starting from more tight searches
        candidateSearch.searchTypes.bib.titleAuthorYearAlternates
      ];
    }

    if (searchType === 'YSO') {
      return [
        candidateSearch.searchTypes.auth.authURX
      ];
    }

    throw new Error('Unsupported match validation package');
  }
}

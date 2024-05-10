
import createInterface from './standard-identifier-factory';
import {parse as isbnParse} from 'isbn3';
import createDebugLogger from 'debug';

const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:ISBN`);
const debugData = debug.extend('data');

export default () => {
  const IDENTIFIER_NAME = 'ISBN';

  function validatorAndNormalizer(string) {
    const isbnParseResult = isbnParse(string);
    debugData(`isbnParseResult: ${JSON.stringify(isbnParseResult)}`);
    if (isbnParseResult === null) {
      debug(`Not parseable ISBN, just removing hyphens`);
      return {valid: false, value: string.replace(/-/ug, '')};
    }
    debug(`Parseable ISBN, normalizing to ISBN-13`);
    return {valid: true, value: isbnParseResult.isbn13};
  }

  const {extract, compare} = createInterface({identifier: IDENTIFIER_NAME, pattern: /^020$/u, subfieldCodes: ['a', 'z'], validIdentifierSubfieldCodes: ['a'], invalidIdentifierSubfieldCodes: ['z'], validatorAndNormalizer});
  return {extract, compare, name: IDENTIFIER_NAME};
};


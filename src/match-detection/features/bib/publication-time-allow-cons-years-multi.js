
import createDebugLogger from 'debug';
import {testStringOrNumber} from '../../../matching-utils.js';

// We should also get copyright time and copyright/publication times from 26x
// We should also get publishing time type from f008
// We should get reprint times from f500 $a "Lisäpainos/Lisäpainokset:"

export default () => ({
  name: 'Publication time, allow consequent years, years from multiple sources',
  extract: ({record, recordExternal}) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/publication-time-allow-cons-years-multi');
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    const f008Values = extractF008Values(record);
    debug(`${label}: f008: ${JSON.stringify(f008Values)}`);

    const f26xValues = extractF26xValues(record);
    debug(`${label}: f26x: ${JSON.stringify(f26xValues)}`);

    const f500Values = extractF500Years(record);
    debug(`${label}: f500: ${JSON.stringify(f500Values)}`);

    // We should get copyrightYear from f008Date2 to copyrightYears when f008YearType = 'r'
    // Is the original year (f008Date2) in f008YearType === 'r' comparable to copyrightYear?
    // We should handle unknown years (here or comparison?)
    // We should handle year ranges for continuing resources / collections

    const normalYears = [...new Set(f26xValues.normalYears.concat(f008Values.f008Date1).filter(value => value && value !== '    ' && value !== '||||'))].sort();
    const copyrightYears = [...new Set(f26xValues.copyrightYears)].sort();
    const reprintYears = [...new Set(f500Values)].sort();

    const combined = {normalYears, copyrightYears, reprintYears};

    debug(`Combined: ${JSON.stringify(combined)}`);

    return combined;

    function extractF008Values(record) {
      // Record should have only one f008 - in case of several, we handle the first one
      const value = record.get(/^008$/u)?.[0]?.value || undefined;
      if (value && testStringOrNumber(value)) {
        const f008Date1 = extractF008Date1(value);
        const f008Date2 = extractF008Date2(value);
        const f008YearType = extractF008YearType(value);
        return {f008Date1, f008Date2, f008YearType};
      }
      return {f008Date1: undefined, f008Date2: undefined, f008YearType: undefined};

      function extractF008Date1(value) {
        return String(value).slice(7, 11);
      }

      function extractF008Date2(value) {
        return String(value).slice(11, 15);
      }

      function extractF008YearType(value) {
        return String(value).slice(6, 7);
      }
    }

    function extractF26xValues(record) {
      const copyrightRegex = /^(?<copyrightPrefix>cop|cop.|c|©|p|℗)/u;

      const pubNormalSubFieldValues = extractPubNormalSubfieldValues(record, copyrightRegex);
      debug(`Normal years: ${JSON.stringify(pubNormalSubFieldValues)}`);

      const pubF264CopySubFieldValues = extractPubF264CopySubfieldValues(record);
      debug(`F264 copyright years: ${JSON.stringify(pubF264CopySubFieldValues)}`);

      const pubF260CopySubFieldValues = extractPubF260CopySubfieldValues(record, copyrightRegex);
      debug(`F260 copyright years: ${JSON.stringify(pubF260CopySubFieldValues)}`);

      return {normalYears: pubNormalSubFieldValues, copyrightYears: [...pubF260CopySubFieldValues, ...pubF264CopySubFieldValues]};

      function extractPubNormalSubfieldValues(record, copyrightRegex) {
        return record.get(/^26[04]$/u)
          .filter((field) => !(field.tag === '264' && field.ind2 === '4'))
          .map(({subfields}) => subfields)
          .flat()
          .filter(({code}) => code && code === 'c')
          .filter(({value}) => value && !copyrightRegex.test(value))
          .map(({value}) => value)
          .map((value) => removeNonAlphaNumeric(value));
      }

      function extractPubF264CopySubfieldValues(record, copyrightRegex) {
        return record.get(/^264$/u)
          .filter((field) => field.ind2 === '4')
          .map(({subfields}) => subfields)
          .flat()
          .filter(({code}) => code && code === 'c')
          .filter(({value}) => value)
          .map(({value}) => value)
          .map((value) => value.replace(copyrightRegex, ''))
          .map((value) => removeNonAlphaNumeric(value));
      }

      function extractPubF260CopySubfieldValues(record, copyrightRegex) {
        return record.get(/^260$/u)
          .map(({subfields}) => subfields)
          .flat()
          .filter(({code}) => code && code === 'c')
          .filter(({value}) => value && copyrightRegex.test(value))
          .map(({value}) => value)
          .map((value) => value.replace(copyrightRegex, ''))
          .map((value) => removeNonAlphaNumeric(value));
      }

      function removeNonAlphaNumeric(value) {
        debug(`Cleaning: ${JSON.stringify(value)}`);
        const nonAlphaNumericRegex = /[^A-Za-z0-9]/ug;
        return value ? value.replace(nonAlphaNumericRegex, '') : value;
      }
    }

    function extractF500Years(record) {

      const reprintRegex = /(?<reprint>Lisäpainokset:|Lisäpainos:)/u;
      const reprintFieldContents = record.get(/^500$/u)
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'a')
        .map(({value}) => value);
      //.filter(value => value.test(reprintRegex));

      debug(`f500 reprint field contents: ${JSON.stringify(reprintFieldContents)}`);

      const filteredF500 = reprintFieldContents.filter((content) => content && content.match(reprintRegex));

      debug(`f500 reprint field contents (filtered): ${JSON.stringify(filteredF500)}`);

      const reprintYears = extractReprintYears(filteredF500);

      return reprintYears;
    }

    function extractReprintYears(contents) {
      const yearRegex = /[0-9][0-9][0-9][0-9]/gu;
      const years = contents.map(content => content.match(yearRegex))
        .flat();
      debug(`${JSON.stringify(years)}`);
      const uniqYears = [...new Set(years)].sort();
      debug(`${JSON.stringify(uniqYears)}`);
      return uniqYears;
    }

  },
  // eslint-disable-next-line max-statements
  compare: (a, b) => {
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/publication-time-allow-cons-years-multi');
    debug(`Comparing ${JSON.stringify(a)} to ${JSON.stringify(b)}`);

    const [firstA] = a.normalYears ? a.normalYears : a;
    const [firstB] = b.normalYears ? b.normalYears : b;

    debug(`Comparing ${JSON.stringify(firstA)} to ${JSON.stringify(firstB)}`);

    if (firstA === firstB) {
      return 0.1;
    }

    // If either of years is a non string/number, values are not comparable
    if (!testStringOrNumber(firstA) || !testStringOrNumber(firstB)) {
      return 0;
    }

    const firstANumber = parseInt(firstA, 10);
    const firstBNumber = parseInt(firstB, 10);

    // Handle consequent years as a match
    // see publication-time for a version that does not handle consequent years as a match
    if (!(isNaN(firstANumber) || isNaN(firstBNumber)) &&
      (firstANumber + 1 === firstBNumber || firstANumber - 1 === firstBNumber)) {
      return 0.1;
    }

    // We should do something with copyrightYears, too

    // Do not give minus points if a normal publishing year is found in normal years
    const bNormalInANormal = a.normalYears.filter(aValue => b.normalYears.some(bValue => aValue === bValue));
    const aNormalInBNormal = b.normalYears.filter(bValue => a.normalYears.some(aValue => bValue === aValue));
    debug(`BNorm in ANorm: ${JSON.stringify(bNormalInANormal)}`);
    debug(`ANorm in BNorm: ${JSON.stringify(aNormalInBNormal)}`);

    if (bNormalInANormal > 0 || aNormalInBNormal > 0) {
      return 0;
    }

    // Do not give minus points if a normal publishing year is found in reprint years
    const bNormalInAReprint = a.reprintYears.filter(aValue => b.normalYears.some(bValue => aValue === bValue));
    const aNormalInBReprint = b.reprintYears.filter(bValue => a.normalYears.some(aValue => bValue === aValue));
    debug(`BNorm in AReprint: ${JSON.stringify(bNormalInAReprint)}`);
    debug(`ANorm in BReprint: ${JSON.stringify(aNormalInBReprint)}`);

    if (bNormalInAReprint > 0 || aNormalInBReprint > 0) {
      return 0;
    }

    return -1;

  }
});

// https://www.loc.gov/marc/bibliographic/bd008.html
// field 008
// 06 - Type of date/Publication status
// 07-10 - Date 1
// 11-14 - Date 2
//
// 06 - Type of date/Publication status
// b - No dates given; B.C. date involved
// c - Continuing resource currently published
// d - Continuing resource ceased publication
// e - Detailed date
// i - Inclusive dates of collection
// k - Range of years of bulk of collection
// m - Multiple dates
// n - Dates unknown
// p - Date of distribution/release/issue and production/recording session when different
// q - Questionable date
// r - Reprint/reissue date and original date
// s - Single known date/probable date
// t - Publication date and copyright date
// u - Continuing resource status unknown
// | - No attempt to code
//
// 07-10 - Date 1
// 1-9 - Date digit
// # - Date element is not applicable
// u - Date element is totally or partially unknown
// |||| - No attempt to code
//
// 11-14 - Date 2
// 1-9 - Date digit
// # - Date element is not applicable
// u - Date element is totally or partially unknown
// |||| - No attempt to code
//


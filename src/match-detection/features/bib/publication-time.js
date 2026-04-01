// We should also get copyright time and copyright/publication times from 26x
// see publication-time-allow-cons-years for a version allowing consequent years to match

import {extractPublicationYearFrom773} from '../../../candidate-search/query-list/component.js';

const MAX = 0.1;
const MIN = -1.0;



export default () => ({
  name: 'Publication time',
  extract: ({record}) => {
    let dateData = getDataFrom008();
    const [f773] = record.get(/^773$/u);
    const hostYear = f773 && extractPublicationYearFrom773(f773) || null;
    dateData.hostYear = hostYear;
    return dateData;

    function getDataFrom008() {
      const [f008] = record.get(/^008$/u);
      if (!f008 || f008.value.length < 16) {
        return splitDateData('|        ');
      }
      return splitDateData(f008.value.slice(6, 15));
    }

    function splitDateData(data) {
      const typeOfDate = data[0]; // 008/06
      const date1 = data.slice(1,5); // 008/07-10
      const date2 = data.slice(5); // 008/11-14
      return {typeOfDate, date1, date2};
    }
  },

  compare: (aa, bb) => {
    // Be happy with a f773$g match:
    if (aa.hostYear && bb.hostYear && aa.hostYear === bb.hostYear) {
      return MAX;
    }
    // Check 008
    if (aa.typeOfDate === 'b') { // 008/06: Before Christ. No really makes sense in our domain, though.
      if (bb.typeOfDate === 'b') {
        return 0;
      }
      return MIN;
    }
    if (aa.typeOfDate === 'n' || bb.typeOfDate === 'n') { // n=unknown
      return 0;
    }

    // Try to handle questionable dates:
    if (aa.typeOfDate === 'q') { // questionable data
      if (bb.typeOfDate !== 'q') {
        if (yearInBetween(aa.date1, bb.date1, aa.date2)) {
          return MAX;
        }
        return MIN;
      }

      // What if there are questionable dates on both sides?
      if (aa.date1 === bb.date1 && bb.date1 === bb.date2) {
        return MAX;
      }
      // Lazily return 0. (We could check for overlap etc. but not really worth the effort)
      return 0.0;
    }
    if (bb.typeOfDate === 'q') {
      if (yearInBetween(bb.date1, aa.date1, bb.date2)) {
        return MAX;
      }
      return MIN;
    }

    const skipList = ['    ', '||||', 'uuuu'];
    if (skipList.includes(aa.date1) || skipList.includes(bb.date1)) { // 008/07-10 carries no information
      return 0;
    }

    if (matchingYears(aa.date1, bb.date1)) { // 'u' support
      return MAX;
    }


    return MIN;
  }

});

function yearInBetween(start, curr, end) {
  if (!isValidYear(start) || !isValidYear(curr) || !isValidYear(end)) {
    return false;
  }
  return start <= curr && curr <= end;
}

export function matchingYears(yyyy1, yyyy2) {
  if (yyyy1.length === 0) { // All digits have been succesfully consumed -> success
    return true;
  }
  if (yyyy1[0] === 'u' || yyyy2[0] === 'u') { // Ignore 'u' (it refers to unknown millenia, century, decade or year)
    return matchingYears(yyyy1.slice(1), yyyy2.slice(1));
  }
  if (yyyy1[0] !== yyyy2[0]) {
    return false;
  }
  if (yyyy1[0] >= '0' && yyyy1[0] <= '9') { // Require that yyyy[0] is a digit at this point? (What if year is 983?)
    return matchingYears(yyyy1.slice(1), yyyy2.slice(1));
  }
  return false;
}


const validYearRegexp = /^(?:1[89][0-9][0-9]|20[012][0-9])$/u;

function isValidYear(yyyy) {
  return validYearRegexp.test(yyyy); // Currently supports 1800-2029
}

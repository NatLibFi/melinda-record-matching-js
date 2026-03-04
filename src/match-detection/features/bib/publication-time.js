

import {testStringOrNumber} from '../../../matching-utils.js';

// We should also get copyright time and copyright/publication times from 26x
// see publication-time-allow-cons-years for a version allowing consequent years to match

export default () => ({
  name: 'Publication time',
  extract: ({record}) => {
    return getDateData();
    //const value = record.get(/^008$/u)?.[0]?.value || undefined;
    //return testStringOrNumber(value) ? [String(value).slice(6, 15)] : [];

    function getDateData() {
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
    if (aa.typeOfDate === 'b') { // Berfore Christ. No really makes sense in our domain, though.
      if (bb.typeOfDate === 'b') {
        return 0;
      }
      return -1.0;
    }
    if (aa.typeOfDate === 'n' || bb.typeOfDate === 'n') { // n=unknown
      return 0;
    }

    const skipList = ['    ', '||||', 'uuuu'];
    if (skipList.includes(aa.date1) || skipList.includes(bb.date1)) { // 008/07-10 carries no information
      return 0;
    }

    if (matchingYears(aa.date1, bb.date1)) { // 'u' support
      return 0.1;
    }

    // TODO: add $q support here

    return -1.0;

    function matchingYears(yyyy1, yyyy2) {
      if (yyyy1.length === 0) { // All digits have been succesfully consumed -> success
        return true;
      }
      if (yyyy1[0] === 'u' || yyyy2[0] === 'u') { // Ignore 'u' (it refers to unknown millenia, century, decade or year)
        return matchingYears(yyyy1.slice(1), yyyy2.slice(1));
      }
      if (yyyy1[0] !== yyyy2[0]) {
        return false;
      }
      // Should we require that yyyy[0] is a digit at this point?
      return matchingYears(yyyy1.slice(1), yyyy2.slice(1));
    }

    /*
    function hasFourDigits(yyyy) { // Will be needed by 'q' support
      return yyyy.match(/^[0-9]{4}$/u);
    }
      */
  }

});



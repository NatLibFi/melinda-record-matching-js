

import {LevenshteinDistance as leven} from 'natural';
import {testStringOrNumber} from '../../../matching-utils';

// We should extract also organisational authors (110/710)

export default ({nameTreshold = 10} = {}) => ({
  name: 'Authors',
  extract: ({record}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    const authors = record.get(/^(?<def>100|700)$/u)
      .map(({subfields}) => {
        return subfields
          .filter(({code, value}) => code && value)
          .filter(({code}) => ['a', '0'].includes(code))
          .map(toObj)
          .reduce((acc, v) => ({...acc, ...v}), {});

        function toObj({code, value}) {
          if (code === 'a') {
            return {name: testStringOrNumber(value) ? String(value).replace(/[^\p{Letter}\p{Number}]/gu, '').toLowerCase() : ''};
          }

          return {id: value};
        }
      });
    return authors;
  },
  compare: (a, b) => {
    const maxAuthors = a.length > b.length ? a.length : b.length;
    const matchingIds = findMatchingIds();

    if (maxAuthors >= 3 && matchingIds >= 3) {
      return 0.3;
    }

    const matchingNames = findMatchingNames();
    const idPoints = matchingIds / maxAuthors * 0.3;
    const namePoints = matchingNames / maxAuthors * 0.2;
    const totalPoints = idPoints + namePoints;

    return totalPoints <= 0.2 ? totalPoints : 0.2;

    function findMatchingIds() {
      return findMatches('id', (a, b) => a === b);
    }

    function findMatchingNames() {
      return findMatches('name', (a, b) => {
        const distance = leven(a, b);

        if (distance === 0) {
          return true;
        }

        const maxLength = getMaxLength();
        const percentage = distance / maxLength * 100;

        return percentage <= nameTreshold;

        function getMaxLength() {
          return a.length > b.length ? a.length : b.length;
        }
      });
    }

    function findMatches(key, cb) {
      const valuesA = a.filter(o => o[key]).map(o => o[key]);
      const valuesB = b.filter(o => o[key]).map(o => o[key]);
      const allValues = valuesA.concat(valuesB);

      return allValues.reduce((acc, value) => {
        const occurrance = allValues.filter(otherValue => cb(value, otherValue)).length;
        return occurrance >= 2 ? acc + 1 : acc;
      }, 0);
    }
  }
});

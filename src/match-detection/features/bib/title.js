import {LevenshteinDistance as leven} from 'natural';

export default ({treshold = 5} = {}) => ({
  name: 'Title',
  extract: record => {
    const title = getTitle();

    if (title) {
      return [title.replace(/[^\w\p{Alphabetic}]/gu, '').trim()];
    }

    return [];

    function getTitle() {
      const [field] = record.get(/^245$/u);

      if (field) {
        return field.subfields
          .filter(({code}) => ['a', 'b'].includes(code))
          .map(({value}) => value)
          .join('');
      }
    }
  },
  compare: (a, b) => {
    const distance = leven(a[0], b[0]);

    if (distance === 0) {
      return 0.5;
    }

    const maxLength = getMaxLength();
    const percentage = distance / maxLength * 100;

    if (percentage <= treshold) {
      return 0.3;
    }

    return -0.5;

    function getMaxLength() {
      return a[0].length > b[0].length ? a[0].length : b[0].length;
    }

  }
});

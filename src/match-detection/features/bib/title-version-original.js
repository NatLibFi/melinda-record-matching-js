
import createDebugLogger from 'debug';
import naturalPkg from 'natural';
const {LevenshteinDistance: leven} = naturalPkg;

export default ({threshold = 10} = {}) => ({
  name: 'titleVersionOriginal',
  extract: ({record}) => {
    const title = getTitle();

    if (title) {
      return [title.replace(/[^\p{Letter}\p{Number}]/gu, '').toLowerCase()];
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
    const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features/bib/title-version-original');
    const distance = leven(a[0], b[0]);

    if (distance === 0) {
      return 0.5;
    }

    const maxLength = getMaxLength();
    const percentage = distance / maxLength * 100;

    debug(`'${a}' vs '${b}': Max length = ${maxLength}, distance = ${distance}, percentage = ${percentage}`);

    if (percentage <= threshold) {
      return 0.3;
    }

    return -0.5;

    function getMaxLength() {
      return a[0].length > b[0].length ? a[0].length : b[0].length;
    }

  }
});

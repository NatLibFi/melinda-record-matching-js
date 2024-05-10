/* eslint-disable max-statements */


import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:media-type');
const debugData = debug.extend('data');

export default () => ({
  name: 'Media type',
  extract: ({record, recordExternal}) => {
    const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';
    debugData(`Record (${label}): ${JSON.stringify(record)}`);
    debugData(`RecordExternal: ${JSON.stringify(recordExternal)}`);
    const values337 = get337Values();
    debug(`${label} 337 $b values: ${JSON.stringify(values337)}`);

    return values337;

    function get337Values() {
      return record.get(/^337$/u)
        .filter(f => f.subfields.some((subfield) => subfield.code === '2' && subfield.value === 'rdamedia'))
        .map(({subfields}) => subfields)
        .flat()
        .filter(({code}) => code === 'b')
        .map(({value}) => value);
    }
  },
  compare: (a, b) => {
    debugData(`Comparing ${JSON.stringify(a)} and ${JSON.stringify(b)}`);

    // Should we give extra good points if all mediaTypes match?
    // Should we give partial points for partially matching mediaTypes?
    // Should we check whether recordType is 'mixedMaterials'
    // Should we okay typical cases of not totally matching mediaTypes? What would these be?

    if (a.every(elem => b.includes(elem))) {
      debug(`All mediaTypes from A are in B`);
      return 1;
    }

    if (b.every(elem => a.includes(elem))) {
      debug(`All mediaTypes from B are in A`);
      return 1;
    }

    debug(`Mismatch in mediaTypes between A and B`);
    return -1;

  }
});

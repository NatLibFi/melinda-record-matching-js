import {uniqArray} from '@natlibfi/marc-record-validators-melinda/dist/utils.js';
import createDebugLogger from 'debug';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection:features:publisher-number');
const debugData = debug.extend('data');

export default () => ({
  name: 'Publisher or Distributor Number',
  extract: ({record/*, recordExternal*/}) => {
    //const label = recordExternal && recordExternal.label ? recordExternal.label : 'record';

    return getIdentifiers();

    function getIdentifiers() {
      const values = fieldsToPublisherNumber(record.get(/^028$/u));

      debug(`\t ${values.length} potential publisher identifiers: ${values.join(', ')}`);

      return uniqArray(values);

      function fieldsToPublisherNumber(fields, result = []) {
        const [field, ...remainingFields] = fields;
        if (!field) {
          return result;
        }
        const a = field.subfields.find(sf => sf.code === 'a');
        if (!a || !a.value) {
          return fieldsToPublisherNumber(remainingFields, result);
        }
        const aval = normalizePublisherNumber(`${a.value}`);

        const b = field.subfields.find(sf => sf.code === 'b');
        if (!b || !b.value) {
          return fieldsToPublisherNumber(remainingFields, [...result, aval]);
        }
        const baval = normalizePublisherNumber(`${b.value}${a.value}`);
        return fieldsToPublisherNumber(remainingFields, [...result, baval, aval]);
      }

      function normalizePublisherNumber(val) {
        return val.replace(/[- .,:;]/ug, '');
      }
    }
  },
  compare: (aa, bb) => {
    debugData(`Comparing identifier sets ${JSON.stringify(aa)} and ${JSON.stringify(bb)}`);
    if (aa.length === 0 || bb.length === 0) {
      // No data for decision
      return 0;
    }
    const firstSharedIdentifier = aa.find(val => bb.includes(val));
    if (firstSharedIdentifier) {
      debug(`\t Shared identifier found: '${firstSharedIdentifier}'`);
      // Maybe less for comps?
      return 0.2;
    }

    const aa2 = aa.map(a => a.replace(/[^0-9]/ug, ''));
    const bb2 = bb.map(b => b.replace(/[^0-9]/ug, ''));

    // Numbers matches (aka don't penalize "Fazer F-123" vs "F-123")
    // Note that FOOLP-123 vs FOOCD-123 will now also return 0.0. Still nothing positive is returned, so no damage done.
    if (aa2.find(val => val !== '' && bb2.includes(val))) {
      return 0.0;
    }

    return -0.2;

  }
});


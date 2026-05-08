// SID checker: if organization ($c) is same, also id ($b) should always be same.
// Return values: 0 (no problems) and -1.0 (conflict, press panic button)
// Raison d'être: SID check is also done in match validator, but as I (nvolk) somehow managed to bypass it with Saamelaisbibliografia imports.
// Also the earlier we filter these weeds, the better.
// Re-implementation is simpler (and lighter) than importing and using match validator's implementation (sigh!).
// But of course, there should be but one implementation...

import { fieldToString } from '@natlibfi/marc-record-validators-melinda';
import createDebugLogger from 'debug';

const debug = createDebugLogger(`@natlibfi/melinda-record-matching:match-detection:features:standard-identifiers:SID`);
const debugData = debug.extend('data');


export default () => ({
  name: 'SID',
  extract: ({record/*, recordExternal*/}) => {
    const SIDs = record.get('SID');
    return SIDs;
  },
  compare: (aa, bb) => {
    debugData(`Comparing SID sets ${JSON.stringify(aa)} and ${JSON.stringify(bb)}`);
    if (aa.length === 0 || bb.length === 0) {
      return 0;
    }

    if (aa.some(field1 => bb.some(field2 => hasConflict(field1, field2)))) {
      return -1.0; // Big bad number that prevents match
    }
    return 0;

    function hasConflict(f1, f2) {
      // Check organisation:
      const b1 = f1.subfields.find(sf => sf.code === 'b');
      const b2 = f2.subfields.find(sf => sf.code === 'b');
      //debug(`SID\$b: ${b1.value} VS ${b2.value}`);
      if (!b1 || !b1.value || !b2 || !b2.value || b1.value !== b2.value) { // Different orgs can not have a conflict
        return false;
      }
      // Check local ID:
      const c1 = f1.subfields.find(sf => sf.code === 'c');
      const c2 = f2.subfields.find(sf => sf.code === 'c');
      const result = c1 && c2 && c1.value && c2.value && c1.value !== c2.value;
      //debug(`SID\$c: ${c1.value} VS ${c2.value} => ${result}`);
      return result;
    }
  }
});

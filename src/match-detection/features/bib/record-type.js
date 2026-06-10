// RecordType
//
// Array structure:
// 0: record type
// 1: is soitonopas; The English translation for soitionopas is both terrible and unused in Melinda, that I'm not using it ("musical instrument methods")

export default () => ({
  name: 'Record type',
  extract: ({record}) => {
    const recordType = record.leader[6] || null;
    const soitonopas = isSoitonopas();

    return [recordType, soitonopas];

    function isSoitonopas() {
      if (recordType === 'c') {
        const f300 = record.get('300');
        if (f300.some(f => f.subfields?.some(sf => sf.code === 'a' && sf.value.match(/(?:instrumentskol|soitonopas)/ui)))) {
          return true;       
        }
      }
      return false;
    }
  },
  compare: (a, b) => {
     if (a[0] === b[0]) {
      return 0.1;
    }
    // Soitonopas vs text/book: no bonus, no penalty
    if (a[0] === 'a' && b[1]) {
      return 0.0;
    }
    if (b[0] === 'a' && a[1]) {
      return 0.0;
    }
    // Bad:
    return  -0.5
  }
});

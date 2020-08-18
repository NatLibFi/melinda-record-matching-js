export default () => ({
  name: 'Language',
  extract: record => {
    const value008 = get008Value();
    const values041 = get041Values();

    if (value008 && values041.length > 0) {
      const correspondingValue = values041.find(v => v === value008);
      return correspondingValue ? [correspondingValue] : [];
    }

    return value008 ? [value008] : [values041[0]];

    function get008Value() {
      const value = record.get(/^008$/u)?.[0]?.value || [];
      return value.slice(35, 38);
    }

    function get041Values() {
      return record.get(/^041$/u).map(({subfields}) => subfields
        .filter(({code}) => code === 'a')
        .map(({value}) => value));
    }
  },
  compare: (a, b) => {
    if (a[0] === b[0]) {
      return 0.1;
    }

    return a[0] === 'und' || b[0] === 'und' ? 0.0 : -1.0;
  }
});

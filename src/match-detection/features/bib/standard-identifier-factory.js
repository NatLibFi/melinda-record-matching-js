export default ({pattern, subfieldCodes}) => {
  return {extract, compare};

  function extract(record) {
    const [field] = record.get(pattern);

    if (field) {
      return field.subfields
        .filter(({code}) => subfieldCodes.includes(code))
        .map(({code, value}) => ({code, value: value.replace(/-/ug, '')}));
    }

    return [];
  }

  function compare(a, b) {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    if (bothHaveValidIdentifiers()) {
      const {maxValues, matchingValues} = getValueCount(true);
      return matchingValues / maxValues * 0.75;
    }

    const {maxValues, matchingValues} = getValueCount(true);
    return matchingValues / maxValues * 0.2;

    function bothHaveValidIdentifiers() {
      const aValues = a.filter(({code}) => code === 'a');
      const bValues = a.filter(({code}) => code === 'a');
      return aValues.length > 0 && bValues.length > 0;
    }

    function getValueCount(validOnly = false) {
      const aValues = getIdentifiers(a);
      const bValues = getIdentifiers(b);

      return {
        maxValues: aValues.length > bValues.length ? aValues.length : bValues.length,
        matchingValues: aValues.filter(aValue => bValues.some(bValue => aValue === bValue))
      };

      function getIdentifiers(values) {
        if (validOnly) {
          return values
            .filter(({code}) => code === 'a')
            .map(({value}) => value);
        }

        return values.map(({value}) => value);
      }
    }
  }
};

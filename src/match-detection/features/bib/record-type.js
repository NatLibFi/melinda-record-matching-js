
// we could handle the case of books/notes
// Recordtype: LDR/06 - Type of Record
// Note: currently matchValidator fails all mismatching recordTypes, so this won't actually do much

export default () => ({
  name: 'Record type',
  extract: ({record}) => record.leader[6] ? [record.leader[6]] : [],
  compare: (a, b) => a[0] === b[0] ? 0.1 : -0.5
});


export default () => ({
  name: 'Bibliographic level',
  extract: ({record}) => record.leader[7] ? [record.leader[7]] : [],
  compare: (a, b) => a[0] === b[0] ? 0.1 : -0.2
});

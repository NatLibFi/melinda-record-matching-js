export default () => ({
  name: 'Record type',
  extract: r => [r.leader[6]],
  compare: (a, b) => a[0] === b[0] ? 0.1 : -0.5
});

export default () => ({
  name: 'Bibliographic level',
  extract: r => r.leader[7] ? [r.leader[7]] : [],
  compare: (a, b) => a[0] === b[0] ? 0.1 : -0.2
});

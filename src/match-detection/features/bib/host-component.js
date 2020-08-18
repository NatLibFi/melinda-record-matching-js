export default () => ({
  name: 'Host/Component record',
  extract: r => r.get(/^773$/u).length > 0 ? ['component'] : ['host'],
  compare: (a, b) => a[0] === b[0] ? 0.0 : -1.0
});

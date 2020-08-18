export default () => ({
  name: 'Publication time',
  extract: record => {
    const value = record.get(/^008$/u)?.[0]?.value || '';
    return value.slice(7, 11);
  },
  compare: (a, b) => a[0] === a[b] ? 0.1 : -1.0
});

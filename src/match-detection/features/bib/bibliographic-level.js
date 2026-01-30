
export default () => ({
  name: 'Bibliographic level',
  extract: ({record}) => record.leader[7] ? [record.leader[7]] : [],
  compare: (a, b) => {
    if (a[0] === b[0]) {
      return 0.1;
    }
    // See MELINDA-7427: We have millions of LDR/07='b' where they should be LDR/07='a'. So don't penalize for these...
    if (a[0] === 'a' && b[0] === 'b') {
      return 0.0;
    }
    if (a[0] === 'b' && b[0] === 'a') {
      return 0.0;
    }
    return -0.2;
  }
});

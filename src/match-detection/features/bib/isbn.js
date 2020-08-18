import createInterface from './standard-identifier-factory';

export default () => {
  const {extract, compare} = createInterface({pattern: /^020$/u, subfieldCodes: ['a', 'z']});
  return {extract, compare, name: 'ISBN'};
};

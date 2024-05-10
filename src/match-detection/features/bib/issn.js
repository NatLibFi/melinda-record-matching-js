
import createInterface from './standard-identifier-factory';

export default () => {
  const {extract, compare} = createInterface({pattern: /^022$/u, subfieldCodes: ['a', 'z', 'y']});
  return {extract, compare, name: 'ISSN'};
};

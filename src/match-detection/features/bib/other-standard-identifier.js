
import createInterface from './standard-identifier-factory.js';

// DEVELOP: we should compare indicators and sf2 for f024

export default () => {
  const {extract, compare} = createInterface({pattern: /^024$/u, subfieldCodes: ['a', 'z']});
  return {extract, compare, name: 'Other standard identifier'};
};


import createInterface from './melinda-identifier-factory';

export default () => {
  const {extract, compare} = createInterface();
  return {extract, compare, name: 'melinda-id'};
};

import assert from 'node:assert';
import {describe, it} from 'node:test';
import generateStrategy, {allowedSearchTypes} from '../src/cli-strategies.js';

// Consistency pin: each CLI strategy must list exactly these features, in this order.
// The mirrored strategies (IDS, STANDARD_IDS, CONTENT, CONTENTALT) must match the
// validator's composition exactly; the _F773 variants append f773() to it
describe('CLI-STRATEGIES', () => {
  // NOTE: the f773 feature's own name string contains a trailing space
  const expectedFeatures = {
    IDS: ['melinda-id', 'All source IDs'],
    IDS_F773: ['melinda-id', 'All source IDs', 'f773 '],
    STANDARD_IDS: [
      'Host/Component record',
      'ISBN',
      'SetVolumeLevel',
      'ISSN',
      'Publisher',
      'f338',
      'Serial level (whole vs component)',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Authors',
      'Record type',
      'Publication time, allow consequent years, years from multiple sources',
      'Language',
      'Bibliographic level'
    ],
    STANDARD_IDS_F773: [
      'Host/Component record',
      'ISBN',
      'SetVolumeLevel',
      'ISSN',
      'Publisher',
      'f338',
      'Serial level (whole vs component)',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Authors',
      'Record type',
      'Publication time, allow consequent years, years from multiple sources',
      'Language',
      'Bibliographic level',
      'f773 '
    ],
    COMPONENT: [
      'Host/Component record',
      'Other standard identifier',
      'Record type',
      'Title',
      'Language',
      'Authors',
      'Bibliographic level',
      'f773 '
    ],
    CONTENT: [
      'Host/Component record',
      'ISBN',
      'ISSN',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Title',
      'Authors',
      'Record type',
      'Publication time',
      'Language',
      'Bibliographic level'
    ],
    CONTENTALT: [
      'Host/Component record',
      'ISBN',
      'ISSN',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Title',
      'Authors',
      'Record type',
      'Publication time',
      'Language',
      'Bibliographic level'
    ],
    CONTENT_F773: [
      'Host/Component record',
      'ISBN',
      'ISSN',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Title',
      'Authors',
      'Record type',
      'Publication time',
      'Language',
      'Bibliographic level',
      'f773 '
    ],
    CONTENTALT_F773: [
      'Host/Component record',
      'ISBN',
      'ISSN',
      'Publisher or Distributor Number',
      'Other standard identifier',
      'Title',
      'Authors',
      'Record type',
      'Publication time',
      'Language',
      'Bibliographic level',
      'f773 '
    ],
    YSO: ['yso']
  };

  it('exposes the ten allowed CLI search types', () => {
    assert.deepStrictEqual(allowedSearchTypes, Object.keys(expectedFeatures));
  });

  for (const searchType of Object.keys(expectedFeatures)) {
    it(`generates the pinned feature list for ${searchType}`, () => {
      const strategy = generateStrategy(searchType);
      assert.deepStrictEqual(strategy.map(feature => feature.name), expectedFeatures[searchType]);
    });
  }

  it('applies the ISSN_POSITIVE_WEIGHT env value to the mirrored STANDARD_IDS issn feature', () => {
    const issnFeature = searchType => generateStrategy(searchType).find(feature => feature.name === 'ISSN');
    const sharedIssn = ['0001-2345'];

    // Default weight 0.75 when the env variable is not set
    assert.strictEqual(issnFeature('STANDARD_IDS').compare(sharedIssn, sharedIssn), 0.75);
    assert.strictEqual(issnFeature('STANDARD_IDS_F773').compare(sharedIssn, sharedIssn), 0.75);

    const previous = process.env.ISSN_POSITIVE_WEIGHT;
    process.env.ISSN_POSITIVE_WEIGHT = '0.9';
    try {
      assert.strictEqual(issnFeature('STANDARD_IDS').compare(sharedIssn, sharedIssn), 0.9);
      assert.strictEqual(issnFeature('STANDARD_IDS_F773').compare(sharedIssn, sharedIssn), 0.9);
    } finally {
      if (previous === undefined) {
        delete process.env.ISSN_POSITIVE_WEIGHT;
      } else {
        process.env.ISSN_POSITIVE_WEIGHT = previous;
      }
    }
  });

  it('keeps the bare issn() weight in non-mirrored strategies', () => {
    // Bare issn() uses the factory default positiveWeight of 0.2
    const issnFeature = searchType => generateStrategy(searchType).find(feature => feature.name === 'ISSN');
    const sharedIssn = ['0001-2345'];
    assert.strictEqual(issnFeature('CONTENT').compare(sharedIssn, sharedIssn), 0.2);
    assert.strictEqual(issnFeature('CONTENTALT_F773').compare(sharedIssn, sharedIssn), 0.2);
  });
});

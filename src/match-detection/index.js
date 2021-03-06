/* eslint-disable no-console */
/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Melinda record matching modules for Javascript
*
* Copyright (C) 2020 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-matching-js
*
* melinda-record-matching-js program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-matching-js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import createDebugLogger from 'debug';
import * as features from './features';

export {features};

// eslint-disable-next-line max-statements
export default ({strategy, treshold = 0.9}) => (recordA, recordB) => {
  const minProbabilityQuantifier = 0.5;

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection');
  const debugData = debug.extend('data');
  const featuresA = extractFeatures(recordA);
  const featuresB = extractFeatures(recordB);

  debugData(`Features (a): ${JSON.stringify(featuresA)}`);
  debugData(`Features (b): ${JSON.stringify(featuresB)}`);

  const featurePairs = generateFeaturePairs();
  const similarityVector = generateSimilarityVector();

  if (similarityVector.some(v => v >= minProbabilityQuantifier)) {
    const probability = calculateprobability();
    debug(`probability: ${probability} (Treshold: ${treshold})`);
    return {match: probability >= treshold, probability};
  }

  debugData(`No feature yielded minimum probability amount of points (${minProbabilityQuantifier})`);
  return {match: false, probability: 0.0};

  function calculateprobability() {
    const probability = similarityVector.reduce((acc, v) => acc + v, 0.0);
    return probability > 1.0 ? 1.0 : probability;
  }

  function extractFeatures(record) {
    return strategy.reduce((acc, {name, extract}) => acc.concat({name, value: extract(record)}), []);
  }

  function generateSimilarityVector() {
    const compared = featurePairs.map(({name, a, b}) => {
      const {compare} = strategy.find(({name: featureName}) => name === featureName);
      const points = compare(a, b);
      return {name, points};
    });

    debugData(`Points: ${JSON.stringify(compared)}`);
    return compared.map(({points}) => points);
  }

  function generateFeaturePairs() {
    const pairs = generatePairs();
    const missingFeatures = findMissing();

    debug(`Not comparing the following features because one, or both records are missing features: ${JSON.stringify(missingFeatures)}`);
    return pairs;

    function generatePairs() {
      return featuresA
        .reduce((acc, {name, value}, index) => acc.concat({
          name,
          a: value,
          b: featuresB[index].value
        }), [])
        .filter(({a, b}) => {
          if (a.length === 0 || b.length === 0) {
            return false;
          }

          return true;
        });
    }

    function findMissing() {
      return featuresA
        .map(({name}) => name)
        .filter(v => pairs.some(({name}) => name === v) === false);
    }
  }
};

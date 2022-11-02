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

export default ({strategy, treshold = 0.9}, returnStrategy = false) => ({recordA, recordB, recordAExternal = {}, recordBExternal = {}}) => {
  const minProbabilityQuantifier = 0.5;

  const debug = createDebugLogger('@natlibfi/melinda-record-matching:match-detection');
  const debugData = debug.extend('data');

  debugData(`Strategy: ${JSON.stringify(strategy)}, Treshold: ${JSON.stringify(treshold)}, ReturnStrategy: ${JSON.stringify(returnStrategy)}`);
  debugData(`Records: A: ${recordA}\nB: ${recordB}`);
  debug(`Externals: A: ${JSON.stringify(recordAExternal)}, B: ${JSON.stringify(recordBExternal)}`);
  // We could add here labels for records if we didn't get external labels

  const featuresA = extractFeatures({record: recordA, recordExternal: recordAExternal});

  debug(`We got an array of records: ${Array.isArray(recordB)}`);
  const recordsB = Array.isArray(recordB) ? recordB : [recordB];
  const recordsBExternal = Array.isArray(recordB) ? recordBExternal : [recordBExternal];

  const detectionResults = recordsB.map((record, index) => actualDetection({featuresA, recordAExternal, record, recordExternal: recordsBExternal[index], index}));

  // if we got array of records, we return an array of result
  // if we got a singular record, we return a singular result
  return Array.isArray(recordB) ? detectionResults : detectionResults[0];

  function actualDetection({featuresA, record, recordExternal, index}) {
    const labelA = recordAExternal && recordAExternal.label ? recordAExternal.label : 'a';
    const labelB = recordExternal && recordExternal.label ? recordExternal.label : 'b';


    debug(`Actual detection for record ${index + 1} ${labelB}`);
    const featuresB = extractFeatures({record, recordExternal});

    debugData(`Features (a: ${labelA}): ${JSON.stringify(featuresA)}`);
    debugData(`Features (b: ${labelB}): ${JSON.stringify(featuresB)}`);

    const featurePairs = generateFeaturePairs(featuresA, featuresB);
    const similarityVector = generateSimilarityVector(featurePairs);

    if (similarityVector.some(v => v >= minProbabilityQuantifier)) {
      const probability = calculateProbability(similarityVector);
      debug(`probability: ${probability} (Treshold: ${treshold})`);
      return returnResult({match: probability >= treshold, probability});
    }

    debugData(`No feature yielded minimum probability amount of points (${minProbabilityQuantifier})`);
    return returnResult({match: false, probability: 0.0});
  }

  function extractFeatures({record, recordExternal}) {
    return strategy.reduce((acc, {name, extract}) => acc.concat({name, value: extract({record, recordExternal})}), []);
  }

  function returnResult(result) {
    if (returnStrategy) {
      debug(`Returning detection strategy with the result`);
      const resultWithStrategy = {match: result.match, probability: result.probability, strategy: formatStrategy(strategy), treshold};
      debugData(`${JSON.stringify(resultWithStrategy)}`);
      return resultWithStrategy;
    }
    return result;
  }

  function formatStrategy(strategy) {
    const strategyNames = strategy.map(element => element.name);
    return strategyNames || [];
  }

  function calculateProbability(similarityVector) {
    const probability = similarityVector.reduce((acc, v) => acc + v, 0.0);
    return probability > 1.0 ? 1.0 : probability;
  }

  function generateSimilarityVector(featurePairs) {
    const compared = featurePairs.map(({name, a, b}) => {
      const {compare} = strategy.find(({name: featureName}) => name === featureName);
      const points = compare(a, b);
      return {name, points};
    });

    debugData(`Points: ${JSON.stringify(compared)}`);
    return compared.map(({points}) => points);
  }

  function generateFeaturePairs(featuresA, featuresB) {
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

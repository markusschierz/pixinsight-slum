const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSpfcProperties, readSpfc, checkSpfcSet } = require('../src/slum-spfc.js');

const complete = (scale = 2) => ({ version: 1, normalization: 1e8,
  scale: [scale], sigma: [0.1], fwhmx: [5], fwhmy: [5], counts: [100] });

test('accepts a complete monochrome SPFC calibration', () => {
  assert.deepEqual(validateSpfcProperties(complete()), {
    valid: true, scale: 2, normalization: 1e8, version: 1, sigma: 0.1, count: 100,
  });
});

test('rejects missing, incomplete and nonfinite calibration values', () => {
  for (const value of [null, [], [NaN], [Infinity], [0], [-2], ['2'], [1, 2]])
    assert.equal(validateSpfcProperties({ ...complete(), scale: value }).valid, false);
  assert.equal(validateSpfcProperties({ ...complete(), counts: null }).valid, false);
  assert.equal(validateSpfcProperties({ ...complete(), version: 2 }).valid, false);
  assert.equal(validateSpfcProperties({ ...complete(), normalization: 0 }).valid, false);
  assert.equal(validateSpfcProperties({ ...complete(), normalization: '100000000' }).valid, false);
  assert.equal(validateSpfcProperties({ ...complete(), counts: [1.5] }).valid, false);
});

test('requires matching SPFC normalization across all selected channels', () => {
  const rows = [complete(2), complete(3)].map(spfc => ({ spfc: validateSpfcProperties(spfc) }));
  assert.equal(checkSpfcSet(rows), true);
  rows[1].spfc.normalization = 2e8;
  assert.equal(checkSpfcSet(rows), false);
  assert.match(rows[1].spfc.reason, /Normierung/);
});

test('rejects a modified loaded view even when complete SPFC properties remain', () => {
  const values = complete();
  const keys = { ScaleFactors: values.scale, Sigmas: values.sigma,
    FWHMx: values.fwhmx, FWHMy: values.fwhmy, Counts: values.counts,
    NormalizationFactor: values.normalization, Version: values.version };
  const view = { hasProperty: id => id.slice(9) in keys,
    propertyValue: id => keys[id.slice(9)] };
  assert.equal(readSpfc(view).valid, true);
  assert.match(readSpfc({ hasProperty: () => true, propertyValue: () => {
    throw new Error('kaputt');
  } }, false).reason, /nicht lesbar/);
});

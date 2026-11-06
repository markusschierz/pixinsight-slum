const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateNoise, countWarning } = require('../src/slum-stats.js');

test('scales MRS noise by Sn and reports count percentage', () => {
  const result = estimateNoise({
    Sn: () => 2,
    selectedRect: { area: 100 },
    noiseMRS: () => [0.4, 50],
  });
  assert.equal(result.noise, 0.2);
  assert.equal(result.countPercent, 50);
  assert.equal(result.layers, 4);
});

test('falls back to k-sigma when MRS finds too few pixels', () => {
  const layers = [];
  const result = estimateNoise({
    Sn: () => 2,
    selectedRect: { area: 1000 },
    noiseMRS: (n) => { layers.push(n); return [0.3, 5]; },
    noiseKSigma: () => [0.2, 100],
  });
  assert.deepEqual(layers, [4, 3, 2]);
  assert.equal(result.noise, 0.1);
  assert.equal(result.countPercent, 10);
});

test('warns at the specified count thresholds without changing a weight', () => {
  assert.match(countWarning(24.99), /DEUTLICHE/);
  assert.match(countWarning(25), /Warnung/);
  assert.equal(countWarning(50), '');
  assert.throws(() => countWarning(NaN), /Invalid/);
});

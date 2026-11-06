const test = require('node:test');
const assert = require('node:assert/strict');
const { sampleMedians, estimateNoise } = require('../src/slum-stats.js');

function image(rows) {
  return {
    width: rows[0].length,
    height: rows.length,
    sample: (x, y) => rows[y][x],
  };
}

test('uses only pixels valid in every channel for reference medians', () => {
  const medians = sampleMedians([
    image([[0, 0.2, 0.4], [0.6, 1, 0.8]]),
    image([[0.1, 0.3, 0.5], [0, 0.7, 0.9]]),
  ]);
  assert.deepEqual(medians, [0.4, 0.5]);
});

test('rejects images without a shared valid pixel', () => {
  assert.throws(() => sampleMedians([
    image([[0, 0.2]]),
    image([[0.3, 1]]),
  ]), /common|valid/i);
});

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

const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseReference, computeWeights, computeSlumMix } = require('../src/slum-core.js');

test('chooses the lowest median among selected channels', () => {
  assert.equal(chooseReference([
    { id: 'L', median: 0.0163 },
    { id: 'R', median: 0.0155 },
    { id: 'B', median: 0.0154 },
  ]), 'B');
});

test('breaks equal-median ties in L R G B order', () => {
  assert.equal(chooseReference([
    { id: 'B', median: 0.01 },
    { id: 'G', median: 0.01 },
  ]), 'G');
});

test('normalizes inverse variance weights for equal sampling', () => {
  const result = computeWeights([
    { id: 'L', noise: 1.070, group: 'bin1' },
    { id: 'R', noise: 1.071, group: 'bin1' },
    { id: 'G', noise: 1.119, group: 'bin1' },
    { id: 'B', noise: 1.107, group: 'bin1' },
  ]);
  assert.ok(Math.abs(result.reduce((sum, row) => sum + row.weight, 0) - 1) < 1e-12);
  assert.ok(Math.abs(result[0].weight - 0.25996) < 0.00002);
  assert.ok(Math.abs(result[2].weight - 0.23769) < 0.00002);
});

test('applies explicit shares between different sampling groups', () => {
  const result = computeWeights([
    { id: 'L', noise: 0.9, group: 'bin1' },
    { id: 'R', noise: 0.5, group: 'bin2' },
    { id: 'G', noise: 0.4, group: 'bin2' },
  ], { bin1: 0.7, bin2: 0.3 });
  assert.ok(Math.abs(result[0].weight - 0.7) < 1e-12);
  assert.ok(Math.abs(result[1].weight + result[2].weight - 0.3) < 1e-12);
  assert.ok(result[2].weight > result[1].weight);
});

test('rejects invalid noise and incomplete shares', () => {
  assert.throws(() => computeWeights([
    { id: 'L', noise: 0, group: 'bin1' },
    { id: 'R', noise: 1, group: 'bin1' },
  ]), /noise/i);
  assert.throws(() => computeWeights([
    { id: 'L', noise: 1, group: 'bin1' },
    { id: 'R', noise: 1, group: 'bin2' },
  ], { bin1: 0.7, bin2: 0.2 }), /100/i);
});

test('rejects unknown channel identifiers', () => {
  assert.throws(() => chooseReference([
    { id: 'toString', median: 0.01 }, { id: 'R', median: 0.02 },
  ]), /Ungültiger/);
  assert.throws(() => computeWeights([
    { id: 'toString', noise: 1, group: 'bin1' },
    { id: 'R', noise: 1, group: 'bin1' },
  ]), /Ungültiger/);
});

test('builds RGBLUM by inverse noise then assigns the chosen L fraction', () => {
  const mix = computeSlumMix([
    { id: 'L', noise: 0.8, group: '1x1' },
    { id: 'R', noise: 1, group: '1x1' },
    { id: 'G', noise: 2, group: '1x1' },
    { id: 'B', noise: 2, group: '1x1' },
  ], null, 0.7);
  assert.equal(mix.lFraction, 0.7);
  assert.deepEqual(mix.rgbWeights.map(x => x.weight), [2/3, 1/6, 1/6]);
  assert.ok(Math.abs(mix.weights[0].weight - 0.7) < 1e-12);
  assert.ok(Math.abs(mix.weights[1].weight - 0.2) < 1e-12);
  assert.ok(Math.abs(mix.weights[2].weight - 0.05) < 1e-12);
  assert.ok(Math.abs(mix.weights[3].weight - 0.05) < 1e-12);
});

test('supports L plus one color and the 50/80 percent boundaries', () => {
  const rows = [{ id: 'L', noise: 1, group: '1x1' },
    { id: 'B', noise: 3, group: '2x2' }];
  assert.deepEqual(computeSlumMix(rows, null, 0.5).weights.map(x => x.weight), [0.5, 0.5]);
  assert.ok(Math.abs(computeSlumMix(rows, null, 0.8).weights[1].weight - 0.2) < 1e-12);
  for (const value of [0.49, 0.81, NaN, undefined, '0.7'])
    assert.throws(() => computeSlumMix(rows, null, value), /L-Anteil/);
});

test('uses sampling shares only within RGBLUM and preserves RGB-only weighting', () => {
  const rgb = [{ id: 'R', noise: 1, group: '1x1' },
    { id: 'G', noise: 1, group: '2x2' },
    { id: 'B', noise: 2, group: '2x2' }];
  const shares = { '1x1': 0.4, '2x2': 0.6 };
  const withL = computeSlumMix([{ id: 'L', noise: 0.5, group: '1x1' }, ...rgb], shares, 0.7);
  assert.ok(Math.abs(withL.weights[0].weight - 0.7) < 1e-12);
  assert.ok(Math.abs(withL.weights[1].weight - 0.12) < 1e-12);
  assert.ok(Math.abs(withL.weights[2].weight - 0.144) < 1e-12);
  assert.ok(Math.abs(withL.weights[3].weight - 0.036) < 1e-12);
  assert.throws(() => computeSlumMix([{ id: 'L', noise: 1, group: '1x1' }, ...rgb], null, 0.7), /100/);
  assert.deepEqual(computeSlumMix(rgb, shares, null).weights,
    computeWeights(rgb, shares));
});

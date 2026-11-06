const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseReference, computeWeights } = require('../src/slum-core.js');

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

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

test('automatically weights different RGB sampling groups by final noise', () => {
  const result = computeWeights([
    { id: 'R', noise: 1, group: '1x1' },
    { id: 'G', noise: 2, group: '2x2' },
    { id: 'B', noise: 2, group: '3x3' },
  ]);
  assert.deepEqual(result.map(row => row.weight), [2/3, 1/6, 1/6]);
});

test('rejects invalid noise and manual channel weights', () => {
  assert.throws(() => computeWeights([
    { id: 'L', noise: 0, group: 'bin1' },
    { id: 'R', noise: 1, group: 'bin1' },
  ]), /noise/i);
  const rgb = [{ id: 'R', noise: 1, group: '1x1' },
    { id: 'G', noise: 1, group: '2x2' }, { id: 'B', noise: 1, group: '3x3' }];
  assert.throws(() => computeWeights(rgb, { R: 0.7, G: 0.2, B: 0 }), /100/i);
  assert.throws(() => computeWeights(rgb, { R: 0.7, G: 0.3 }), /Kanalgewicht/i);
  assert.throws(() => computeWeights(rgb, { R: 1.1, G: 0, B: -0.1 }), /Kanalgewicht/i);
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

test('supports L plus one color and the 20/80 percent boundaries', () => {
  const rows = [{ id: 'L', noise: 1, group: '1x1' },
    { id: 'B', noise: 3, group: '2x2' }];
  assert.deepEqual(computeSlumMix(rows, null, 0.2).weights.map(x => x.weight), [0.2, 0.8]);
  assert.ok(Math.abs(computeSlumMix(rows, null, 0.8).weights[1].weight - 0.2) < 1e-12);
  for (const value of [0.19, 0.81, NaN, undefined, '0.7'])
    assert.throws(() => computeSlumMix(rows, null, value), /L-Anteil/);
});

test('manual R/G/B weights override noise only inside RGBLUM', () => {
  const rgb = [{ id: 'R', noise: 1, group: '1x1' },
    { id: 'G', noise: 1, group: '2x2' },
    { id: 'B', noise: 2, group: '2x2' }];
  const manual = { R: 0.4, G: 0.35, B: 0.25 };
  const withL = computeSlumMix([{ id: 'L', noise: 0.5, group: '1x1' }, ...rgb], manual, 0.7);
  assert.ok(Math.abs(withL.weights[0].weight - 0.7) < 1e-12);
  assert.ok(Math.abs(withL.weights[1].weight - 0.12) < 1e-12);
  assert.ok(Math.abs(withL.weights[2].weight - 0.105) < 1e-12);
  assert.ok(Math.abs(withL.weights[3].weight - 0.075) < 1e-12);
  assert.equal(withL.weightMode, 'manual');
  assert.deepEqual(computeWeights(rgb, { R: 1, G: 0, B: 0 }).map(x => x.weight), [1, 0, 0]);
  assert.deepEqual(computeSlumMix(rgb, manual, null).weights,
    computeWeights(rgb, manual));
  const automatic = computeSlumMix([{ id: 'L', noise: 1, group: '1x1' }, ...rgb], null, 0.7);
  assert.equal(automatic.weightMode, 'auto');
  assert.ok(Math.abs(automatic.weights[1].weight - 0.3 / 2.25) < 1e-12);
});

const { mixExpression, SATURATION_TARGET } = require('../src/slum-core.js');

test('mix expression without correction keeps the plain L/RGB blend', () => {
  assert.equal(mixExpression(0.66, 'Lum', '(0.5*R)+(0.5*G)', null),
    '(0.66000000000000003*Lum)+(0.33999999999999997*((0.5*R)+(0.5*G)))');
});

test('saturation correction lowers the L share only through the zone image', () => {
  const e = mixExpression(0.66, 'Lum', '(1*R)', 'Zone');
  const d = (0.66 - SATURATION_TARGET).toPrecision(17);
  assert.ok(e.includes('Zone'));
  assert.ok(e.includes(d));
  assert.equal(e.replace(/Zone/g, 'Z').includes('min(1,'), true);
});

test('saturation correction is a no-op when L share is already at or below the target', () => {
  assert.equal(mixExpression(0.2, 'Lum', '(1*R)', 'Zone'),
    mixExpression(0.2, 'Lum', '(1*R)', null));
  assert.equal(mixExpression(SATURATION_TARGET, 'Lum', '(1*R)', 'Zone'),
    mixExpression(SATURATION_TARGET, 'Lum', '(1*R)', null));
});

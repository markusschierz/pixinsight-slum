const test = require('node:test');
const assert = require('node:assert/strict');
const { selectedChannels, samplingKey, nativeSampling, geometrySignature,
  sameAstrometricPoints, nearAstrometricPoints } = require('../src/slum-engine.js');

test('accepts a two-channel subset and rejects duplicate paths', () => {
  assert.deepEqual(selectedChannels({ R: { path: '/a.fit' }, B: { path: '/b.fit' } }).map(x => x.id), ['R', 'B']);
  assert.throws(() => selectedChannels({ R: { path: '/a.fit' }, B: { path: '/a.fit' } }), /Dieselbe Datei/);
  assert.throws(() => selectedChannels({ L: { path: '/a.fit' } }), /mindestens zwei/);
});

test('accepts mixed file and loaded view sources per channel', () => {
  const selected = selectedChannels({
    L: { source: 'view', viewId: 'Lum', path: '/ignored.fit' },
    R: { source: 'file', path: '/r.fit' },
  });
  assert.deepEqual(selected.map(x => [x.id, x.source, x.viewId || x.path]), [
    ['L', 'view', 'Lum'], ['R', 'file', '/r.fit'],
  ]);
  assert.throws(() => selectedChannels({
    L: { source: 'view', viewId: 'Lum' },
    B: { source: 'view', viewId: 'Lum' },
  }), /Ansicht.*mehreren/);
  assert.throws(() => selectedChannels({
    L: { source: 'view', viewId: 'Lum' },
    B: { source: 'unknown', path: '/b.fit' },
  }), /Quelltyp/);
});

test('normalizes explicit native sampling and rejects missing sampling', () => {
  assert.equal(samplingKey('2 × 2'), '2x2');
  assert.equal(samplingKey('1,5x1,5'), '1.5x1.5');
  assert.throws(() => samplingKey(''), /Sampling/);
  assert.throws(() => samplingKey('0x2'), /positiv/);
  assert.equal(nativeSampling({ XBINNING: '1', YBINNING: '2' }), '1x2');
  assert.equal(nativeSampling({}), '');
});

test('requires complete matching WCS metadata for automatic registration assurance', () => {
  assert.equal(geometrySignature({ CTYPE1: 'RA---TAN' }), '');
  const header = { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRPIX1: '1', CRPIX2: '2', CRVAL1: '3', CRVAL2: '4', CDELT1: '5', CDELT2: '6' };
  assert.ok(geometrySignature(header));
  assert.notEqual(geometrySignature(header), geometrySignature({ ...header, CRPIX1: '9' }));
});

test('detects a different astrometric raster and handles RA wraparound', () => {
  const points = [[359.99999999, 1], [10, 2], [20, 3]];
  assert.equal(sameAstrometricPoints(points, [[0.00000001, 1], [10, 2], [20, 3]]), true);
  assert.equal(sameAstrometricPoints(points, [[0.1, 1], [10, 2], [20, 3]]), false);
  assert.equal(sameAstrometricPoints(points, [[359.99999999, 1], [10, 2.1], [20, 3]]), false);
});

test('requires confirmation for small plate-solve differences but rejects large shifts', () => {
  const a = [[180.78, -18.68], [180.52, -18.87], [180.17, -19.07]];
  const near = a.map(([ra, dec]) => [ra + 0.00002, dec - 0.00002]);
  const far = a.map(([ra, dec]) => [ra + 0.01, dec]);
  assert.equal(nearAstrometricPoints(a, near, 9355, 6252), true);
  assert.equal(nearAstrometricPoints(a, far, 9355, 6252), false);
});

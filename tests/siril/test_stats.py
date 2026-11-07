import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "siril"))

from slum_stats import (common_medians, count_warning, estimate_noise,  # noqa: E402
                        estimate_sigma, linear_fit, sn_scale)


def synthetic(sigma, seed, size=256, gain=1.0, offset=0.0):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size]
    signal = 0.05 + 0.1 * np.exp(-((xx - 128) ** 2 + (yy - 128) ** 2) / 3000.0)
    image = gain * signal + offset + rng.normal(0, sigma, (size, size))
    return np.clip(image, 1e-4, 0.9).astype(np.float32)


class Stats(unittest.TestCase):
    def test_common_medians_ignore_borders_and_saturation(self):
        a = np.full((20, 20), 0.2, dtype=np.float32)
        b = np.full((20, 20), 0.4, dtype=np.float32)
        a[:2] = 0
        b[:, :2] = 1
        self.assertEqual(common_medians([a, b]), [np.float32(0.2), np.float32(0.4)])
        with self.assertRaises(ValueError):
            common_medians([a, np.zeros((20, 20), dtype=np.float32)])
        with self.assertRaises(ValueError):
            common_medians([a, np.zeros((5, 5), dtype=np.float32)])

    def test_sn_scale_matches_sigma_for_gaussian(self):
        values = np.random.default_rng(1).normal(0, 2.0, 20000)
        self.assertAlmostEqual(sn_scale(values), 2.0, delta=0.15)

    def test_sigma_tracks_true_noise(self):
        for sigma in (0.002, 0.004):
            result = estimate_sigma(synthetic(sigma, 1))
            self.assertAlmostEqual(result["sigma"], sigma, delta=0.15 * sigma)
            self.assertGreater(100 * result["count"] / result["area"], 25)

    def test_noisier_image_gets_higher_relative_noise(self):
        base = synthetic(0.002, 2)
        extra = np.random.default_rng(5).normal(0, 0.004, base.shape).astype(np.float32)
        noisy = np.clip(base + extra, 1e-4, 0.9)
        self.assertGreater(estimate_noise(noisy)["noise"], estimate_noise(base)["noise"])

    def test_count_warning_thresholds(self):
        self.assertEqual(count_warning(80), "")
        self.assertIn("<50%", count_warning(30))
        self.assertIn("DEUTLICHE", count_warning(10))
        with self.assertRaises(ValueError):
            count_warning(101)

    def test_linear_fit_recovers_gain_and_offset(self):
        reference = synthetic(0.001, 3)
        target = ((reference - 0.01) / 2.0).astype(np.float32)
        target[:3] = 0
        fitted, slope, offset = linear_fit(target, reference)
        self.assertAlmostEqual(slope, 2.0, delta=0.02)
        self.assertAlmostEqual(offset, 0.01, delta=0.005)
        self.assertTrue((fitted[:3] == 0).all())
        self.assertAlmostEqual(float(np.median(fitted[10:])), float(np.median(reference[10:])),
                               delta=0.002)

    def test_linear_fit_rejects_degenerate_input(self):
        flat = np.full((32, 32), 0.1, dtype=np.float32)
        with self.assertRaises(ValueError):
            linear_fit(flat, synthetic(0.001, 4, size=32))


if __name__ == "__main__":
    unittest.main()

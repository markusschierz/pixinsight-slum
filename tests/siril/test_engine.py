import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "siril"))

from slum_engine import SlumSession, binning_from_header, normalize_pixels  # noqa: E402


def scene(seed, gain, sigma, size=192):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size]
    signal = 0.04 + 0.12 * np.exp(-((xx - 96) ** 2 + (yy - 96) ** 2) / 2500.0)
    return np.clip(gain * signal + rng.normal(0, sigma, signal.shape), 1e-4, 0.9).astype(np.float32)


class Engine(unittest.TestCase):
    def test_normalize_pixels(self):
        self.assertEqual(normalize_pixels(np.array([[65535, 0]], dtype=np.uint16)).tolist(),
                         [[1.0, 0.0]])
        self.assertEqual(normalize_pixels(np.zeros((1, 4, 4), dtype=np.float32)).shape, (4, 4))
        with self.assertRaises(ValueError):
            normalize_pixels(np.zeros((3, 4, 4), dtype=np.float32))
        with self.assertRaises(ValueError):
            normalize_pixels(np.full((4, 4), 2.0, dtype=np.float32))
        with self.assertRaises(ValueError):
            normalize_pixels(np.full((4, 4), np.nan, dtype=np.float32))

    def test_binning_from_header(self):
        self.assertEqual(binning_from_header("XBINNING=                    2 / x"), 2)
        self.assertIsNone(binning_from_header("SIMPLE  = T"))
        self.assertIsNone(binning_from_header(None))

    def test_full_lrgb_pipeline(self):
        session = SlumSession()
        for i, (id, gain, sigma) in enumerate([("L", 1.0, 0.003), ("R", 0.6, 0.002),
                                               ("G", 0.5, 0.002), ("B", 0.4, 0.004)]):
            session.add_channel(id, id + ".fit", scene(i, gain, sigma))
        rows = session.analyze()
        self.assertEqual([r["id"] for r in rows], ["L", "R", "G", "B"])
        self.assertEqual(session.recommended, "B")
        session.prepare()
        mix = session.mix({"L": "1", "R": "1", "G": "1", "B": "1"}, None, 0.7)
        self.assertAlmostEqual(sum(w["weight"] for w in mix["weights"]), 1.0, places=9)
        self.assertAlmostEqual(mix["weights"][0]["weight"], 0.7, places=9)
        slum = session.render(mix)
        self.assertEqual(slum.dtype, np.float32)
        reference = session.channels["B"]["data"]
        self.assertAlmostEqual(float(np.median(slum)), float(np.median(reference)), delta=0.01)
        self.assertIn("Endgewichte", session.protocol(mix, {i: "1" for i in "LRGB"}))

    def test_reference_override_and_validation(self):
        session = SlumSession()
        session.add_channel("R", "r.fit", scene(1, 1.0, 0.002))
        with self.assertRaises(ValueError):
            session.analyze()
        session.add_channel("G", "g.fit", scene(2, 0.8, 0.002))
        with self.assertRaises(ValueError):
            session.add_channel("B", "r.fit", scene(3, 0.8, 0.002))
        session.analyze()
        session.select_reference("R")
        with self.assertRaises(ValueError):
            session.select_reference("L")
        with self.assertRaises(ValueError):
            session.render({"weights": []})

    def test_size_mismatch_is_rejected(self):
        session = SlumSession()
        session.add_channel("R", "r.fit", scene(1, 1.0, 0.002, size=64))
        session.add_channel("G", "g.fit", scene(2, 1.0, 0.002, size=72))
        with self.assertRaisesRegex(ValueError, "Abmessungen"):
            session.analyze()


def saturated_session(l_clipped=True):
    size = 160
    yy, xx = np.mgrid[0:size, 0:size]
    r2 = (xx - 80) ** 2 + (yy - 80) ** 2
    star = np.exp(-r2 / 40.0)
    session = SlumSession()
    for i, (id, gain, clip) in enumerate([("L", 3.0, 1.0), ("R", 1.0, 1.0), ("G", 1.0, 1.0),
                                          ("B", 1.0, 1.0)]):
        rng = np.random.default_rng(i)
        data = 0.05 + gain * 0.5 * star + rng.normal(0, 0.002, star.shape)
        top = clip if (id != "L" or l_clipped) else 0.9
        session.add_channel(id, id + ".fit", np.clip(data, 1e-4, top).astype(np.float32))
    session.analyze()
    session.prepare()
    return session


SAMPLING = {i: "1" for i in "LRGB"}


class SaturationCorrection(unittest.TestCase):
    def test_off_is_identical_to_plain_mix(self):
        session = saturated_session()
        mix = session.mix(SAMPLING, None, 0.66)
        plain = session.render(mix)
        self.assertTrue(np.array_equal(plain, session.render(mix, saturation=False)))

    def test_on_changes_only_the_zone_and_stays_between_plain_mix_and_30_percent_mix(self):
        session = saturated_session()
        mix = session.mix(SAMPLING, None, 0.66)
        off, on = session.render(mix), session.render(mix, saturation=True)
        self.assertTrue(session.saturation_applied)
        self.assertEqual(session.saturated_channels(), ["L"])
        self.assertTrue(np.array_equal(off[:20, :20], on[:20, :20]))
        self.assertFalse(np.array_equal(off, on))
        self.assertTrue(np.array_equal(off[:, :40], on[:, :40]))
        by_id = {r["id"]: r["fitted"] for r in session.rows}
        rgb = sum(np.float32(w["weight"]) * by_id[w["id"]] for w in mix["rgbWeights"])
        floor = np.float32(0.3) * by_id["L"] + np.float32(0.7) * rgb
        low, high = np.minimum(off, floor), np.maximum(off, floor)
        self.assertTrue(((on >= low - 1e-5) & (on <= high + 1e-5)).all())

    def test_unsaturated_l_is_not_touched(self):
        session = saturated_session(l_clipped=False)
        mix = session.mix(SAMPLING, None, 0.66)
        self.assertTrue(np.array_equal(session.render(mix), session.render(mix, saturation=True)))
        self.assertFalse(session.saturation_applied)


if __name__ == "__main__":
    unittest.main()

import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "siril"))

from slum_core import choose_reference, compute_slum_mix, compute_weights  # noqa: E402


def ch(id, noise, group="1x1"):
    return {"id": id, "noise": noise, "group": group}


class CoreParity(unittest.TestCase):
    def test_lowest_median(self):
        self.assertEqual(choose_reference([
            {"id": "L", "median": 0.0163}, {"id": "R", "median": 0.0155},
            {"id": "B", "median": 0.0154}]), "B")

    def test_tie_order(self):
        self.assertEqual(choose_reference([
            {"id": "B", "median": 0.01}, {"id": "G", "median": 0.01}]), "G")

    def test_equal_sampling_weights(self):
        result = compute_weights([ch("L", 1.070, "bin1"), ch("R", 1.071, "bin1"),
                                  ch("G", 1.119, "bin1"), ch("B", 1.107, "bin1")])
        self.assertAlmostEqual(sum(r["weight"] for r in result), 1, places=12)
        self.assertAlmostEqual(result[0]["weight"], 0.25996, delta=0.00002)
        self.assertAlmostEqual(result[2]["weight"], 0.23769, delta=0.00002)

    def test_noise_only_weights(self):
        result = compute_weights([ch("R", 1, "1x1"), ch("G", 2, "2x2"), ch("B", 2, "3x3")])
        self.assertEqual([r["weight"] for r in result], [2 / 3, 1 / 6, 1 / 6])

    def test_rejects_invalid(self):
        with self.assertRaisesRegex(ValueError, "(?i)noise"):
            compute_weights([ch("L", 0), ch("R", 1)])
        rgb = [ch("R", 1, "1x1"), ch("G", 1, "2x2"), ch("B", 1, "3x3")]
        with self.assertRaisesRegex(ValueError, "100"):
            compute_weights(rgb, {"R": 0.7, "G": 0.2, "B": 0})
        with self.assertRaisesRegex(ValueError, "Kanalgewicht"):
            compute_weights(rgb, {"R": 0.7, "G": 0.3})
        with self.assertRaisesRegex(ValueError, "Kanalgewicht"):
            compute_weights(rgb, {"R": 1.1, "G": 0, "B": -0.1})
        with self.assertRaisesRegex(ValueError, "Ungültiger"):
            choose_reference([{"id": "X", "median": 0.01}, {"id": "R", "median": 0.02}])

    def test_rgblum_then_l_fraction(self):
        mix = compute_slum_mix([ch("L", 0.8), ch("R", 1), ch("G", 2), ch("B", 2)], None, 0.7)
        self.assertEqual([x["weight"] for x in mix["rgbWeights"]], [2 / 3, 1 / 6, 1 / 6])
        for got, want in zip(mix["weights"], [0.7, 0.2, 0.05, 0.05]):
            self.assertAlmostEqual(got["weight"], want, places=12)

    def test_l_plus_one_color_and_bounds(self):
        rows = [ch("L", 1), ch("B", 3, "2x2")]
        self.assertEqual([x["weight"] for x in compute_slum_mix(rows, None, 0.2)["weights"]],
                         [0.2, 0.8])
        for value in (0.19, 0.81, math.nan, None, "0.7"):
            with self.assertRaisesRegex(ValueError, "L-Anteil"):
                compute_slum_mix(rows, None, value)

    def test_manual_weights_inside_rgblum_only(self):
        rgb = [ch("R", 1), ch("G", 1, "2x2"), ch("B", 2, "2x2")]
        manual = {"R": 0.4, "G": 0.35, "B": 0.25}
        with_l = compute_slum_mix([ch("L", 0.5)] + rgb, manual, 0.7)
        for got, want in zip(with_l["weights"], [0.7, 0.12, 0.105, 0.075]):
            self.assertAlmostEqual(got["weight"], want, places=12)
        self.assertEqual(with_l["weightMode"], "manual")
        auto = compute_slum_mix([ch("L", 1)] + rgb, None, 0.7)
        self.assertEqual(auto["weightMode"], "auto")
        self.assertAlmostEqual(auto["weights"][1]["weight"], 0.3 / 2.25, places=12)


if __name__ == "__main__":
    unittest.main()

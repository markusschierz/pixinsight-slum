"""SLUM-Ablauf auf numpy-Bildern, unabhängig von Siril."""

import re

import numpy as np

from slum_core import choose_reference, compute_slum_mix
from slum_stats import common_medians, count_warning, estimate_noise, linear_fit

CHANNEL_IDS = ("L", "R", "G", "B")


def normalize_pixels(data):
    """Wandelt Siril-Pixeldaten in ein monochromes float32-Bild mit Werten in [0, 1]."""
    array = np.asarray(data)
    if array.ndim == 3 and array.shape[0] == 1:
        array = array[0]
    if array.ndim != 2:
        raise ValueError("Nur monochrome Master werden unterstützt.")
    if array.dtype == np.uint16:
        return array.astype(np.float32) / 65535.0
    if array.dtype == np.uint8:
        return array.astype(np.float32) / 255.0
    if not np.issubdtype(array.dtype, np.floating):
        raise ValueError("Nicht unterstütztes Pixelformat.")
    array = array.astype(np.float32)
    if not np.isfinite(array).all():
        raise ValueError("Das Bild enthält ungültige Pixelwerte.")
    if array.max() > 1.0:
        raise ValueError("Pixelwerte über 1.0: Bitte linear auf [0, 1] normierte Master verwenden.")
    return array


def binning_from_header(header):
    """Liest XBINNING aus einem FITS-Header-Text; None, wenn nicht vorhanden."""
    if not header:
        return None
    match = re.search(r"^XBINNING\s*=\s*(\d+)", header, re.M)
    if match and 1 <= int(match.group(1)) <= 4:
        return int(match.group(1))
    return None


class SlumSession:
    def __init__(self):
        self.channels = {}
        self.reference = None
        self.recommended = None
        self.prepared = False
        self.rows = []

    def add_channel(self, id, label, data, header=None):
        if id not in CHANNEL_IDS:
            raise ValueError("Ungültiger Kanal.")
        pixels = normalize_pixels(data)
        for other_id, other in self.channels.items():
            if other_id != id and other["label"] == label:
                raise ValueError("Dieselbe Quelle darf nicht mehrfach zugeordnet werden.")
        self.channels[id] = {"label": label, "data": pixels, "header": header}
        self.prepared = False

    def analyze(self):
        ids = [i for i in CHANNEL_IDS if i in self.channels]
        if len(ids) < 2:
            raise ValueError("Bitte mindestens zwei Kanäle belegen.")
        shapes = {self.channels[i]["data"].shape for i in ids}
        if len(shapes) != 1:
            raise ValueError("Alle Bilder brauchen dieselben Abmessungen.")
        medians = common_medians([self.channels[i]["data"] for i in ids])
        self.rows = [{"id": i, "label": self.channels[i]["label"], "median": m,
                      "binning": binning_from_header(self.channels[i]["header"])}
                     for i, m in zip(ids, medians)]
        self.recommended = choose_reference(self.rows)
        self.reference = self.recommended
        self.prepared = False
        return self.rows

    def select_reference(self, id):
        if id not in [r["id"] for r in self.rows]:
            raise ValueError("Die gewählte Referenz gehört nicht zu den Eingaben.")
        self.reference = id
        self.prepared = False

    def prepare(self, progress=lambda text: None):
        if not self.rows:
            raise ValueError("Zuerst Bilder analysieren.")
        reference = self.channels[self.reference]["data"]
        for row in self.rows:
            source = self.channels[row["id"]]["data"]
            if row["id"] == self.reference:
                row["fitted"], row["slope"], row["offset"] = source, 1.0, 0.0
            else:
                progress(f"LinearFit {row['id']} auf {self.reference}")
                row["fitted"], row["slope"], row["offset"] = linear_fit(source, reference)
            progress(f"Noise {row['id']} wird gemessen")
            estimate = estimate_noise(row["fitted"])
            row["noise"] = estimate["noise"]
            row["countPercent"] = estimate["countPercent"]
            row["layers"] = estimate["layers"]
        self.prepared = True

    def mix(self, sampling, manual_weights=None, l_fraction=None):
        members = [{"id": r["id"], "group": sampling[r["id"]], "noise": r.get("noise", 1.0)}
                   for r in self.rows]
        return compute_slum_mix(members, manual_weights, l_fraction)

    def render(self, mix):
        if not self.prepared:
            raise ValueError("Noise wird erst bei der Ausgabe gemessen.")
        by_id = {r["id"]: r for r in self.rows}
        result = np.zeros_like(by_id[self.rows[0]["id"]]["fitted"], dtype=np.float32)
        for item in mix["weights"]:
            result += np.float32(item["weight"]) * by_id[item["id"]]["fitted"]
        return result

    def protocol(self, mix, sampling):
        lines = [f"Referenz: {self.reference} (Empfehlung: {self.recommended}), Verfahren: LinearFit"]
        for row in self.rows:
            warning = count_warning(row["countPercent"])
            lines.append(
                f"{row['id']} [{row['label']}] Sampling {sampling[row['id']]}, "
                f"Median {row['median']:.6f}, Fit a={row['slope']:.5f} b={row['offset']:.6f}, "
                f"Noise {row['noise']:.5f}, count {row['countPercent']:.1f}%"
                + (f" - {warning}" if warning else ""))
        if mix["lFraction"] is not None:
            lines.append(f"L-Anteil {mix['lFraction'] * 100:.1f}%, "
                         f"RGBLUM-Gewichte ({mix['weightMode']}): " +
                         ", ".join(f"{w['id']} {w['weight'] * 100:.1f}%" for w in mix["rgbWeights"]))
        lines.append("Endgewichte: " + ", ".join(
            f"{w['id']} {w['weight'] * 100:.2f}%" for w in mix["weights"]))
        return "\n".join(lines)

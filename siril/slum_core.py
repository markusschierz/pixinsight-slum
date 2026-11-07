"""Reine Rechenlogik von SLUM (Port von src/slum-core.js)."""

import math

_ORDER = {"L": 0, "R": 1, "G": 2, "B": 3}


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) \
        and math.isfinite(value)


def choose_reference(channels):
    """Kanal mit dem niedrigsten Median; bei Gleichstand gilt L, R, G, B."""
    if not channels or not 2 <= len(channels) <= 4:
        raise ValueError("Bitte zwei bis vier Kanäle auswählen.")
    best = None
    seen = set()
    for row in channels:
        if row["id"] not in _ORDER or row["id"] in seen or not _is_number(row["median"]):
            raise ValueError("Ungültiger Kanal oder Medianwert.")
        seen.add(row["id"])
        if best is None or row["median"] < best["median"] or \
                (row["median"] == best["median"] and _ORDER[row["id"]] < _ORDER[best["id"]]):
            best = row
    return best["id"]


def compute_weights(channels, manual_weights=None):
    """1/noise²-Gewichte, auf Summe 1 normiert, oder manuelle Anteile."""
    if not channels or not 1 <= len(channels) <= 4:
        raise ValueError("Bitte ein bis vier Kanäle gewichten.")
    seen = set()
    min_noise = math.inf
    for row in channels:
        if row["id"] not in _ORDER or row["id"] in seen or \
                not isinstance(row.get("group"), str) or not row["group"] or \
                not _is_number(row["noise"]) or row["noise"] <= 0:
            raise ValueError("Ungültiger Kanal, Sampling-Gruppe oder Noise-Wert.")
        seen.add(row["id"])
        min_noise = min(min_noise, row["noise"])
    if manual_weights is not None:
        if len(manual_weights) != len(channels):
            raise ValueError("Manuelles Kanalgewicht fehlt oder ist überzählig.")
        total = 0.0
        for row in channels:
            share = manual_weights.get(row["id"])
            if not _is_number(share) or share < 0 or share > 1:
                raise ValueError("Ungültiges manuelles Kanalgewicht.")
            total += share
        if abs(total - 1) > 1e-9:
            raise ValueError("Manuelle Kanalgewichte müssen zusammen 100 % ergeben.")
        denominator = total
    else:
        denominator = sum((min_noise / row["noise"]) ** 2 for row in channels)
    return [{
        "id": row["id"], "group": row["group"], "noise": row["noise"],
        "weight": manual_weights[row["id"]] if manual_weights is not None
        else (min_noise / row["noise"]) ** 2 / denominator,
    } for row in channels]


def compute_slum_mix(channels, manual_weights=None, l_fraction=None):
    """SLUM = a*L + (1-a)*RGBLUM; ohne L gelten die RGB-Gewichte direkt."""
    if not channels or not 2 <= len(channels) <= 4:
        raise ValueError("Bitte zwei bis vier Kanäle auswählen.")
    mode = "manual" if manual_weights is not None else "auto"
    luminance = [row for row in channels if row["id"] == "L"]
    if not luminance:
        return {"weights": compute_weights(channels, manual_weights), "rgbWeights": None,
                "lFraction": None, "weightMode": mode}
    if not _is_number(l_fraction) or l_fraction < 0.2 or l_fraction > 0.8:
        raise ValueError("L-Anteil muss zwischen 20 und 80 % liegen.")
    colors = [row for row in channels if row["id"] != "L"]
    compute_weights(luminance)
    rgb_weights = compute_weights(colors, manual_weights)
    by_id = {item["id"]: item for item in rgb_weights}
    weights = []
    for row in channels:
        weight = l_fraction if row["id"] == "L" else (1 - l_fraction) * by_id[row["id"]]["weight"]
        weights.append({"id": row["id"], "group": row["group"],
                        "noise": row["noise"], "weight": weight})
    return {"weights": weights, "rgbWeights": rgb_weights,
            "lFraction": l_fraction, "weightMode": mode}

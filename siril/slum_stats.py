"""Statistik für SLUM: gemeinsame Mediane, Noise (Multiskalen-Unterstützung) und LinearFit.

Die Verfahren folgen den PixInsight-Vorlagen (Medianmaske, NoiseEvaluation, LinearFit),
sind aber eine eigene numpy-Umsetzung; Rauschwerte weichen daher leicht ab.
"""

import numpy as np

# Standardabweichung Gauß'schen Rauschens in den ersten vier Starlet-Ebenen.
_STARLET_SIGMA = (0.889, 0.200, 0.086, 0.041)
_KERNEL = np.array([1, 4, 6, 4, 1], dtype=np.float32) / 16


def common_valid_mask(arrays):
    mask = np.ones(arrays[0].shape, dtype=bool)
    for array in arrays:
        mask &= (array > 0) & (array < 1)
    return mask


def common_medians(arrays):
    """Median je Bild über dieselben Pixel, die in allen Bildern in (0, 1) liegen."""
    if not 2 <= len(arrays) <= 4:
        raise ValueError("Bitte zwei bis vier Bilder auswählen.")
    shape = arrays[0].shape
    if any(a.shape != shape for a in arrays):
        raise ValueError("Alle Bilder brauchen dieselben Abmessungen.")
    mask = common_valid_mask(arrays)
    if not mask.any():
        raise ValueError("Keine gemeinsamen gültigen Pixel für den Median.")
    medians = [float(np.median(a[mask])) for a in arrays]
    if not all(0 < m < 1 for m in medians):
        raise ValueError("Keine gemeinsamen gültigen Pixel für den Median.")
    return medians


def sn_scale(values, max_samples=4000, seed=0):
    """Rousseeuw-Croux-Sn-Skala (deterministische Stichprobe bei großen Bildern)."""
    values = np.asarray(values, dtype=np.float64).ravel()
    if values.size > max_samples:
        values = np.random.default_rng(seed).choice(values, max_samples, replace=False)
    if values.size < 2:
        raise ValueError("Zu wenige Pixel für die Skalenschätzung.")
    inner = np.empty(values.size)
    for start in range(0, values.size, 512):
        chunk = values[start:start + 512]
        inner[start:start + 512] = np.median(np.abs(chunk[:, None] - values[None, :]), axis=1)
    return 1.1926 * float(np.median(inner))


def _starlet_details(image, layers):
    smooth = image.astype(np.float32)
    details = []
    for level in range(layers):
        step = 2 ** level
        pad = 2 * step
        padded = np.pad(smooth, pad, mode="reflect")
        rows = sum(_KERNEL[k] * padded[:, k * step:k * step + smooth.shape[1]] for k in range(5))
        blurred = sum(_KERNEL[k] * rows[k * step:k * step + smooth.shape[0], :] for k in range(5))
        details.append(smooth - blurred)
        smooth = blurred
    return details


def _noise_mrs(image, valid, layers):
    details = _starlet_details(image, layers)
    first = details[0]
    sigma = float(np.std(first[valid])) / _STARLET_SIGMA[0]
    region = valid
    for _ in range(6):
        significant = np.zeros(valid.shape, dtype=bool)
        for level in range(layers):
            significant |= np.abs(details[level]) > 3 * sigma * _STARLET_SIGMA[level]
        region = valid & ~significant
        if not region.any():
            break
        sigma = float(np.std(first[region])) / _STARLET_SIGMA[0]
    return sigma, int(region.sum())


def _noise_k_sigma(image, valid):
    first = _starlet_details(image, 1)[0]
    values = first[valid]
    for _ in range(6):
        sigma = float(np.std(values))
        kept = values[np.abs(values - np.mean(values)) <= 3 * sigma]
        if kept.size == values.size or kept.size < 2:
            break
        values = kept
    return float(np.std(values)) / _STARLET_SIGMA[0], int(values.size)


def estimate_sigma(image):
    """Rauschsigma in Bildeinheiten über die Pixel > 0; liefert sigma, count, area, layers."""
    image = np.asarray(image, dtype=np.float32)
    if image.ndim != 2:
        raise ValueError("Noise-Messung erwartet ein 2D-Bild.")
    valid = image > 0
    area = int(valid.sum())
    if area < 64:
        raise ValueError("Ungültige Noise-Skala oder Bildfläche.")
    layers = 4
    while True:
        sigma, count = _noise_mrs(image, valid, layers)
        if count >= 0.01 * area:
            break
        layers -= 1
        if layers == 1:
            sigma, count = _noise_k_sigma(image, valid)
            break
    return {"sigma": sigma, "count": count, "area": area, "layers": layers}


def estimate_noise(image):
    """Noise relativ zur Sn-Skala; liefert noise, count_percent und genutzte Ebenen."""
    image = np.asarray(image, dtype=np.float32)
    result = estimate_sigma(image)
    scale = sn_scale(image[image > 0])
    if not np.isfinite(scale) or scale <= 0:
        raise ValueError("Ungültige Noise-Skala oder Bildfläche.")
    noise = result["sigma"] / scale
    if not np.isfinite(noise) or noise <= 0:
        raise ValueError("Ungültiger Noise-Wert.")
    return {"noise": noise, "countPercent": 100.0 * result["count"] / result["area"],
            "layers": result["layers"]}


def count_warning(percent):
    if not np.isfinite(percent) or percent < 0 or percent > 100:
        raise ValueError("Ungültiger count-Prozentwert.")
    if percent < 25:
        return "DEUTLICHE WARNUNG: count <25%"
    if percent < 50:
        return "Warnung: count <50%"
    return ""


def linear_fit(target, reference, reject_high=0.92, max_samples=2_000_000):
    """Passt target per Gerade a*target+b an reference an; Nullpixel bleiben null."""
    target = np.asarray(target, dtype=np.float32)
    reference = np.asarray(reference, dtype=np.float32)
    if target.shape != reference.shape:
        raise ValueError("Alle Bilder brauchen dieselben Abmessungen.")
    valid = (target > 0) & (reference > 0) & (target < reject_high) & (reference < reject_high)
    x = target[valid].astype(np.float64)
    y = reference[valid].astype(np.float64)
    if x.size < 16:
        raise ValueError("Zu wenige gültige Pixel für LinearFit.")
    if x.size > max_samples:
        pick = np.random.default_rng(0).choice(x.size, max_samples, replace=False)
        x, y = x[pick], y[pick]
    keep = np.ones(x.size, dtype=bool)
    slope = offset = 0.0
    for _ in range(8):
        if np.ptp(x[keep]) == 0:
            raise ValueError("LinearFit nicht möglich: konstantes Bild.")
        slope, offset = np.polyfit(x[keep], y[keep], 1)
        residual = y - (slope * x + offset)
        sigma = 1.4826 * float(np.median(np.abs(residual[keep] - np.median(residual[keep]))))
        updated = np.abs(residual) <= 3 * max(sigma, 1e-12)
        if updated.sum() < 16 or np.array_equal(updated, keep):
            break
        keep = updated
    if not np.isfinite(slope) or slope <= 0:
        raise ValueError("LinearFit ergab keinen positiven Skalierungsfaktor.")
    fitted = np.where(target > 0, slope * target + offset, 0).astype(np.float32)
    return fitted, float(slope), float(offset)

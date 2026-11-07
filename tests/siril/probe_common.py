"""Gemeinsame Hilfen für die Siril-Integrationsproben."""

import numpy as np


def scene(seed, gain, sigma, size=256):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size]
    signal = 0.04 + 0.12 * np.exp(-((xx - 128) ** 2 + (yy - 128) ** 2) / 3000.0)
    return np.clip(gain * signal + rng.normal(0, sigma, signal.shape), 1e-4, 0.9).astype(np.float32)


def write_fits(path, data, xbinning):
    cards = ["SIMPLE  =                    T", "BITPIX  =                  -32",
             "NAXIS   =                    2", f"NAXIS1  = {data.shape[1]:>20}",
             f"NAXIS2  = {data.shape[0]:>20}", f"XBINNING= {xbinning:>20}",
             f"YBINNING= {xbinning:>20}", "END"]
    header = "".join(card.ljust(80) for card in cards)
    header += " " * (-len(header) % 2880)
    body = np.flipud(data).astype(">f4").tobytes()
    body += b"\0" * (-len(body) % 2880)
    with open(path, "wb") as handle:
        handle.write(header.encode("ascii") + body)

"""Integrationsprobe: läuft in echtem Siril (`pyscript tests/siril/siril_probe.py` in einem .ssf).

Schreibt synthetische L/R/G/B-FITS-Dateien, führt die SLUM-Pipeline über sirilpy aus und
meldet das Ergebnis in <workdir>/probe-result.txt.
"""

import os
import sys
import traceback

import numpy as np
import sirilpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "siril"))
sys.path.insert(0, HERE)

from slum_engine import SlumSession, normalize_pixels  # noqa: E402
from slum_siril import capture_current, load_channel, save_result  # noqa: E402
from probe_common import scene, write_fits  # noqa: E402


def main():
    siril = sirilpy.SirilInterface()
    siril.connect()
    work = siril.get_siril_wd()
    report = []
    try:
        paths = {}
        for i, (id, gain, sigma) in enumerate([("L", 1.0, 0.003), ("R", 0.6, 0.002),
                                               ("G", 0.5, 0.002), ("B", 0.4, 0.004)]):
            paths[id] = os.path.join(work, f"probe_{id}.fit")
            if os.path.exists(paths[id]):
                os.remove(paths[id])
            write_fits(paths[id], scene(i, gain, sigma), 2)
        session = SlumSession()
        for id, path in paths.items():
            data, hdr = load_channel(siril, path)
            report.append(f"geladen {id}: shape={data.shape} dtype={data.dtype}")
            session.add_channel(id, os.path.basename(path), data, hdr)
        session.analyze()
        report.append(f"Empfehlung {session.recommended}; Mediane " +
                      str([round(r['median'], 5) for r in session.rows]) +
                      f"; Binning {[r['binning'] for r in session.rows]}")
        session.prepare()
        sampling = {i: "2x2" for i in "LRGB"}
        mix = session.mix(sampling, None, 0.7)
        slum = session.render(mix)
        report.append(session.protocol(mix, sampling))
        out = os.path.join(work, "probe_SLUM.fit")
        if os.path.exists(out):
            os.remove(out)
        save_result(siril, slum, session.channels[session.reference]["header"], out, True)
        back, _ = load_channel(siril, out)
        report.append(f"Ergebnis: shape={back.shape} median={float(np.median(back)):.5f} "
                      f"expected={float(np.median(slum)):.5f}")
        ok = np.allclose(normalize_pixels(back), slum, atol=1e-6)
        report.append("RESULT OK" if ok else "RESULT MISMATCH")
        data, hdr, name = capture_current(siril)
        report.append(f"aktuelles Bild: {name} shape={data.shape}")
    except Exception:
        report.append("ERROR\n" + traceback.format_exc())
    with open(os.path.join(work, "probe-result.txt"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(report) + "\n")


main()

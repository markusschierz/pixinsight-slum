"""UI-Probe in echtem Siril: bedient SLUM.py programmatisch und schreibt probe-ui-result.txt."""

import os
import sys
import tkinter as tk
import traceback
from unittest import mock

import sirilpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "siril"))
sys.path.insert(0, HERE)

from probe_common import scene, write_fits  # noqa: E402
import SLUM  # noqa: E402


def main():
    siril = sirilpy.SirilInterface()
    siril.connect()
    work = siril.get_siril_wd()
    report = []
    try:
        root = tk.Tk()
        app = SLUM.SlumApp(root, siril)
        for i, (id, gain, sigma, binning) in enumerate([("L", 1.0, 0.003, 1), ("R", 0.6, 0.002, 2),
                                                        ("G", 0.5, 0.002, 2), ("B", 0.4, 0.004, 2)]):
            path = os.path.join(work, f"ui_{id}.fit")
            write_fits(path, scene(i, gain, sigma), binning)
            app.path[id].set(path)
        with mock.patch.object(SLUM.messagebox, "showerror", side_effect=lambda *a: report.append("ERRORBOX " + str(a))):
            app.analyze()
            report.append("INFO " + app.info.get("1.0", "end").strip().replace("\n", " | "))
            report.append("sampling " + str({i: app.sampling[i].get() for i in "LRGB"}))
            app.l_percent.set(60)
            app.run()
            report.append("INFO2 " + app.info.get("1.0", "end").strip().replace("\n", " | "))
            app.weight_mode.set("manual")
            for id, value in zip("RGB", ("50", "30", "30")):
                app.manual[id].set(value)
            app.run()
        root.destroy()
        report.append("UI OK" if not any(r.startswith("ERRORBOX") for r in report[:3]) else "UI CHECK")
    except Exception:
        report.append("ERROR\n" + traceback.format_exc())
    with open(os.path.join(work, "probe-ui-result.txt"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(report) + "\n")


main()

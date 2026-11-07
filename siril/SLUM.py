# SPDX-License-Identifier: MIT
# SLUM für Siril: lineare Super-Luminanz aus 2-4 registrierten L-, R-, G-, B-Mastern.
# Version 1.1.0
#
# Aufruf in Siril: Scripts > SLUM.py (Ordner mit slum_*.py in die Skriptpfade aufnehmen).
# Die Master müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein.

import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sirilpy  # noqa: E402

from slum_engine import CHANNEL_IDS, SlumSession  # noqa: E402
from slum_siril import capture_current, load_channel, save_result  # noqa: E402

SAMPLINGS = ("1x1", "2x2", "3x3", "4x4")


def unique_path(folder, stem="SLUM", ext=".fit"):
    candidate, index = os.path.join(folder, stem + ext), 1
    while os.path.exists(candidate):
        candidate = os.path.join(folder, f"{stem}_{index}{ext}")
        index += 1
    return candidate


class SlumApp:
    def __init__(self, root, siril):
        self.root, self.siril = root, siril
        self.session = None
        self.cache = {}
        self.path = {i: tk.StringVar() for i in CHANNEL_IDS}
        self.sampling = {i: tk.StringVar(value="1x1") for i in CHANNEL_IDS}
        self.reference = tk.StringVar()
        self.l_percent = tk.DoubleVar(value=70)
        self.weight_mode = tk.StringVar(value="auto")
        self.manual = {i: tk.StringVar() for i in "RGB"}
        self.output = tk.StringVar(value=unique_path(siril.get_siril_wd()))
        self.open_result = tk.BooleanVar(value=True)
        root.title("SLUM - Super-Luminanz")
        self.build()

    def build(self):
        frame = ttk.Frame(self.root, padding=10)
        frame.grid(sticky="nsew")
        ttk.Label(frame, text="Master (2-4 Kanäle)", font=("", 10, "bold")).grid(
            row=0, column=0, columnspan=5, sticky="w")
        for row, id in enumerate(CHANNEL_IDS, start=1):
            ttk.Label(frame, text=id).grid(row=row, column=0)
            ttk.Entry(frame, textvariable=self.path[id], width=48).grid(row=row, column=1)
            ttk.Button(frame, text="Datei…", command=lambda i=id: self.pick(i)).grid(row=row, column=2)
            ttk.Button(frame, text="Aktuelles Bild",
                       command=lambda i=id: self.use_current(i)).grid(row=row, column=3)
            ttk.Combobox(frame, textvariable=self.sampling[id], values=SAMPLINGS, width=5,
                         state="readonly").grid(row=row, column=4)
        ttk.Label(frame, text="Spalte rechts: natives Sampling/Binning").grid(
            row=5, column=1, columnspan=4, sticky="w")
        ttk.Button(frame, text="Analysieren", command=self.analyze).grid(row=6, column=1, sticky="w")
        self.info = tk.Text(frame, height=6, width=78, state="disabled")
        self.info.grid(row=7, column=0, columnspan=5, pady=4)
        ttk.Label(frame, text="LinearFit-Referenz").grid(row=8, column=0, columnspan=2, sticky="w")
        self.reference_box = ttk.Combobox(frame, textvariable=self.reference, width=5, state="disabled")
        self.reference_box.grid(row=8, column=1, sticky="e")
        ttk.Label(frame, text="L-Anteil an SLUM (%)").grid(row=9, column=0, columnspan=2, sticky="w")
        ttk.Scale(frame, from_=50, to=80, variable=self.l_percent, command=self.update_l_label).grid(
            row=9, column=1, sticky="ew")
        self.l_label = ttk.Label(frame, text="70 %")
        self.l_label.grid(row=9, column=2)
        ttk.Label(frame, text="RGB-Gewichtung").grid(row=10, column=0, columnspan=2, sticky="w")
        ttk.Radiobutton(frame, text="Automatisch (1/noise²)", variable=self.weight_mode,
                        value="auto").grid(row=10, column=1, sticky="w")
        ttk.Radiobutton(frame, text="Manuell (%)", variable=self.weight_mode,
                        value="manual").grid(row=11, column=1, sticky="w")
        manual = ttk.Frame(frame)
        manual.grid(row=11, column=2, columnspan=3, sticky="w")
        for id in "RGB":
            ttk.Label(manual, text=id).pack(side="left")
            ttk.Entry(manual, textvariable=self.manual[id], width=5).pack(side="left", padx=2)
        ttk.Label(frame, text="Ausgabe (neue FITS)").grid(row=12, column=0, columnspan=2, sticky="w")
        ttk.Entry(frame, textvariable=self.output, width=48).grid(row=12, column=1)
        ttk.Button(frame, text="Ziel…", command=self.pick_output).grid(row=12, column=2)
        ttk.Checkbutton(frame, text="Ergebnis in Siril öffnen", variable=self.open_result).grid(
            row=13, column=1, sticky="w")
        ttk.Button(frame, text="SLUM erstellen", command=self.run).grid(row=14, column=1, sticky="w")

    def update_l_label(self, _=None):
        self.l_label.config(text=f"{round(self.l_percent.get())} %")

    def set_info(self, text):
        self.info.config(state="normal")
        self.info.delete("1.0", "end")
        self.info.insert("1.0", text)
        self.info.config(state="disabled")
        self.root.update_idletasks()

    def pick(self, id):
        path = filedialog.askopenfilename(title=f"Master {id}", initialdir=self.siril.get_siril_wd(),
                                          filetypes=[("Bilder", "*.fit *.fits *.fts *.xisf *.tif *.tiff"),
                                                     ("Alle Dateien", "*")])
        if path:
            self.cache.pop(id, None)
            self.path[id].set(path)

    def pick_output(self):
        path = filedialog.asksaveasfilename(initialdir=self.siril.get_siril_wd(),
                                            defaultextension=".fit", filetypes=[("FITS", "*.fit")])
        if path:
            self.output.set(path)

    def use_current(self, id):
        try:
            data, header, name = capture_current(self.siril)
        except Exception as error:
            return messagebox.showerror("SLUM", str(error))
        self.cache[id] = (data, header, name)
        self.path[id].set(name)

    def read_channel(self, id):
        text = self.path[id].get().strip()
        if not text:
            return None
        cached = self.cache.get(id)
        if cached and cached[2] == text:
            return cached
        data, header = load_channel(self.siril, text)
        return data, header, text

    def analyze(self):
        try:
            session = SlumSession()
            for id in CHANNEL_IDS:
                source = self.read_channel(id)
                if source:
                    session.add_channel(id, source[2], source[0], source[1])
            rows = session.analyze()
        except Exception as error:
            return messagebox.showerror("SLUM", str(error))
        self.session = session
        for row in rows:
            if row["binning"]:
                self.sampling[row["id"]].set(f"{row['binning']}x{row['binning']}")
        self.reference_box.config(values=[r["id"] for r in rows], state="readonly")
        self.reference.set(session.recommended)
        self.set_info("\n".join(f"{r['id']}: Median {r['median']:.6f}  ({r['label']})" for r in rows)
                      + f"\nEmpfohlene Referenz: {session.recommended}")

    def manual_weights(self, colors):
        if self.weight_mode.get() != "manual":
            return None
        try:
            return {id: float(self.manual[id].get().replace(",", ".")) / 100 for id in colors}
        except ValueError:
            raise ValueError("Manuelle RGB-Gewichte bitte als Zahlen in Prozent eingeben.")

    def run(self):
        if not self.session:
            return messagebox.showinfo("SLUM", "Bitte zuerst analysieren.")
        try:
            session = self.session
            ids = [r["id"] for r in session.rows]
            sampling = {id: self.sampling[id].get() for id in ids}
            l_fraction = round(self.l_percent.get()) / 100 if "L" in ids else None
            manual = self.manual_weights([i for i in ids if i != "L"])
            session.mix(sampling, manual, l_fraction)
            session.select_reference(self.reference.get())
            session.prepare(self.set_info)
            mix = session.mix(sampling, manual, l_fraction)
            result = session.render(mix)
            save_result(self.siril, result, session.channels[session.reference]["header"],
                        self.output.get().strip(), self.open_result.get())
            self.set_info(session.protocol(mix, sampling) + f"\nGespeichert: {self.output.get()}")
            self.output.set(unique_path(os.path.dirname(os.path.abspath(self.output.get()))))
        except Exception as error:
            messagebox.showerror("SLUM", str(error))


def main():
    siril = sirilpy.SirilInterface()
    if not siril.connect():
        raise RuntimeError("Keine Verbindung zu Siril.")
    root = tk.Tk()
    app = SlumApp(root, siril)
    if os.environ.get("SLUM_UI_SMOKE"):
        root.after(500, root.destroy)
    root.mainloop()
    return app


if __name__ == "__main__":
    main()

# SPDX-License-Identifier: MIT
# SLUM für Siril: lineare Super-Luminanz aus 2-4 registrierten L-, R-, G-, B-Mastern.
# Version 1.2.0
#
# Aufruf in Siril: Scripts > SLUM.py (SLUM.py direkt im Skriptpfad, die Module im Unterordner slum_lib).
# Die Master müssen linear, registriert, gleich beschnitten und gradientenkorrigiert sein.

import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

_HERE = os.path.dirname(os.path.abspath(__file__))
for _path in (os.path.join(_HERE, "slum_lib"), _HERE):
    sys.path.insert(0, _path)

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
        pad = 8
        self.root.minsize(640, 0)
        outer = ttk.Frame(self.root, padding=2 * pad)
        outer.pack(fill="both", expand=True)
        outer.columnconfigure(0, weight=1)

        sources = ttk.LabelFrame(outer, text="Master (2-4 Kanäle)", padding=pad)
        sources.grid(row=0, column=0, sticky="ew")
        sources.columnconfigure(1, weight=1)
        for column, title in ((0, "Kanal"), (1, "Quelle"), (4, "Sampling")):
            ttk.Label(sources, text=title, foreground="gray40").grid(row=0, column=column, sticky="w")
        for row, id in enumerate(CHANNEL_IDS, start=1):
            ttk.Label(sources, text=id, font=("", 10, "bold")).grid(row=row, column=0, sticky="w", pady=2)
            ttk.Entry(sources, textvariable=self.path[id]).grid(row=row, column=1, sticky="ew", padx=pad)
            ttk.Button(sources, text="Datei…", command=lambda i=id: self.pick(i)).grid(row=row, column=2)
            ttk.Button(sources, text="Aktuelles Bild",
                       command=lambda i=id: self.use_current(i)).grid(row=row, column=3, padx=(4, pad))
            ttk.Combobox(sources, textvariable=self.sampling[id], values=SAMPLINGS, width=5,
                         state="readonly").grid(row=row, column=4)
        ttk.Button(sources, text="Analysieren", command=self.analyze).grid(
            row=5, column=0, columnspan=2, sticky="w", pady=(pad, 0))

        self.info = tk.Text(outer, height=5, wrap="word", state="disabled", relief="flat",
                            background="gray95", padx=pad, pady=4)
        self.info.grid(row=1, column=0, sticky="ew", pady=pad)

        options = ttk.LabelFrame(outer, text="Mischung", padding=pad)
        options.grid(row=2, column=0, sticky="ew")
        options.columnconfigure(1, weight=1)
        ttk.Label(options, text="LinearFit-Referenz").grid(row=0, column=0, sticky="w", pady=2)
        self.reference_box = ttk.Combobox(options, textvariable=self.reference, width=5, state="disabled")
        self.reference_box.grid(row=0, column=1, sticky="w", padx=pad)
        ttk.Label(options, text="L-Anteil").grid(row=1, column=0, sticky="w", pady=2)
        ttk.Scale(options, from_=20, to=80, variable=self.l_percent, command=self.update_l_label).grid(
            row=1, column=1, sticky="ew", padx=pad)
        self.l_label = ttk.Label(options, text="70 %", width=6, anchor="e")
        self.l_label.grid(row=1, column=2)
        ttk.Label(options, text="RGB-Gewichtung").grid(row=2, column=0, sticky="w", pady=2)
        modes = ttk.Frame(options)
        modes.grid(row=2, column=1, columnspan=2, sticky="w", padx=pad)
        ttk.Radiobutton(modes, text="Automatisch (1/noise²)", variable=self.weight_mode, value="auto",
                        command=self.toggle_manual).pack(side="left")
        ttk.Radiobutton(modes, text="Manuell (%)", variable=self.weight_mode, value="manual",
                        command=self.toggle_manual).pack(side="left", padx=pad)
        self.manual_frame = ttk.Frame(options)
        self.manual_frame.grid(row=3, column=1, columnspan=2, sticky="w", padx=pad)
        for id in "RGB":
            ttk.Label(self.manual_frame, text=id).pack(side="left")
            ttk.Entry(self.manual_frame, textvariable=self.manual[id], width=5).pack(
                side="left", padx=(4, pad))
        self.manual_frame.grid_remove()

        output = ttk.LabelFrame(outer, text="Ausgabe", padding=pad)
        output.grid(row=3, column=0, sticky="ew", pady=pad)
        output.columnconfigure(0, weight=1)
        ttk.Entry(output, textvariable=self.output).grid(row=0, column=0, sticky="ew")
        ttk.Button(output, text="Ziel…", command=self.pick_output).grid(row=0, column=1, padx=(pad, 0))
        ttk.Checkbutton(output, text="Ergebnis in Siril öffnen", variable=self.open_result).grid(
            row=1, column=0, sticky="w", pady=(pad, 0))

        ttk.Button(outer, text="SLUM erstellen", command=self.run, default="active").grid(
            row=4, column=0, sticky="e")

    def toggle_manual(self):
        if self.weight_mode.get() == "manual":
            self.manual_frame.grid()
        else:
            self.manual_frame.grid_remove()

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

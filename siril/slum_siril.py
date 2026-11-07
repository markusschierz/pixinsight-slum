"""Anbindung an Siril über sirilpy (Laden, Speichern); die Rechenlogik bleibt in slum_engine."""

import os

import numpy as np


def load_channel(siril, path):
    """Lädt ein Bild aus einer Datei, ohne das in Siril geladene Bild zu verändern."""
    if not os.path.isfile(path):
        raise ValueError(f"Datei nicht gefunden: {path}")
    fit = siril.load_image_from_file(path)
    if fit is None or fit.data is None:
        raise ValueError(f"Bild konnte nicht geladen werden: {path}")
    return np.array(fit.data), fit.header


def capture_current(siril):
    """Kopiert das aktuell in Siril geladene Bild; das Original bleibt unverändert."""
    if not siril.is_image_loaded():
        raise ValueError("In Siril ist kein Bild geladen.")
    data = np.array(siril.get_image_pixeldata())
    name = siril.get_image_filename() or "Siril-Bild"
    return data, siril.get_image_fits_header(), name


def save_result(siril, data, header, path, open_in_siril=False):
    """Speichert das SLUM als neue FITS-Datei; vorhandene Dateien werden nie überschrieben."""
    if os.path.exists(path):
        raise ValueError(f"Ziel existiert bereits: {path}")
    folder = os.path.dirname(os.path.abspath(path))
    if not os.path.isdir(folder):
        raise ValueError(f"Zielordner existiert nicht: {folder}")
    if not siril.save_image_file(np.asarray(data, dtype=np.float32), header or "", path):
        raise ValueError("Speichern fehlgeschlagen.")
    if open_in_siril:
        siril.cmd("load", f'"{path}"')

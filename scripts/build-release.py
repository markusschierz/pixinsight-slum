#!/usr/bin/env python3
"""Build a reproducible PixInsight Feature Scripts ZIP without development data."""

import argparse
import hashlib
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
CONTENTS = (
    ("src/SLUM.js", "SLUM/SLUM.js"),
    ("src/SLUM.svg", "SLUM/SLUM.svg"),
    ("src/slum-core.js", "SLUM/slum-core.js"),
    ("src/slum-stats.js", "SLUM/slum-stats.js"),
    ("src/slum-spfc.js", "SLUM/slum-spfc.js"),
    ("src/slum-engine.js", "SLUM/slum-engine.js"),
    ("src/slum-ui.js", "SLUM/slum-ui.js"),
    ("packaging/INSTALL.txt", "SLUM/INSTALL.txt"),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="release tag, e.g. v1.0.1")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    if not re.fullmatch(r"v\d+\.\d+\.\d+", args.version):
        parser.error("version must have the form vMAJOR.MINOR.PATCH")
    script = (ROOT / "src/SLUM.js").read_text(encoding="utf-8")
    targets = {Path(target).name for _, target in CONTENTS}
    includes = set(re.findall(r'^#include\s+"([^"]+)"', script, re.M))
    if not includes or not includes <= targets:
        raise ValueError(f"script includes are missing from the package: {includes - targets}")
    if not re.search(r"^#feature-id\s+SLUM\s*:\s*astro-foto\.ch\s*>\s*SLUM\s*$", script, re.M) or \
            not re.search(r"^#feature-icon\s+SLUM\.svg\s*$", script, re.M):
        raise ValueError("SLUM menu path or icon directive is missing")
    ET.parse(ROOT / "src/SLUM.svg")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / f"SLUM-{args.version}.zip"
    with ZipFile(output, "w") as archive:
        for source, target in CONTENTS:
            data = (ROOT / source).read_bytes()
            entry = ZipInfo(target, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=9)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"{output}\nSHA-256 {digest}")


if __name__ == "__main__":
    main()

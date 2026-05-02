#!/usr/bin/env python3
"""
Extract raw text from DSA 4.1 Basisregelwerk (BRW) PDF for name-table curation.

Usage:
  python scripts/extract_names.py --pdf "D:/path/to/DSA 4.1 Basisregelwerk.pdf"
  python scripts/extract_names.py   # reads TDE4_PDF_reference.txt in repo root for tde_german_rules

Requires: pip install pymupdf

Output: prints text from pages ~55–72 (0-based indices may vary by edition).
Curate results into data/names/culture_names.json by hand.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REF_FILE = REPO_ROOT / "TDE4_PDF_reference.txt"


def resolve_pdf_from_reference() -> Path | None:
    if not REF_FILE.is_file():
        return None
    text = REF_FILE.read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#") or not line or "=" not in line:
            continue
        key, _, rest = line.partition("=")
        if key.strip() != "tde_german_rules":
            continue
        path = rest.strip().strip('"').strip("'")
        p = Path(path)
        if p.is_file():
            return p
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Dump BRW PDF text for name extraction.")
    parser.add_argument("--pdf", type=Path, help="Path to Basisregelwerk PDF")
    parser.add_argument("--start", type=int, default=54, help="First page (1-based), default 54")
    parser.add_argument("--end", type=int, default=73, help="Last page inclusive (1-based), default 73")
    args = parser.parse_args()

    pdf = args.pdf or resolve_pdf_from_reference()
    if not pdf or not pdf.is_file():
        print("No PDF found. Pass --pdf or set tde_german_rules in TDE4_PDF_reference.txt", file=sys.stderr)
        return 1

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Install PyMuPDF: pip install pymupdf", file=sys.stderr)
        return 1

    doc = fitz.open(pdf)
    start = max(1, args.start) - 1
    end = min(len(doc), args.end)
    for i in range(start, end):
        page = doc[i]
        print(f"\n{'='*20} PAGE {i + 1} {'='*20}\n")
        print(page.get_text("text"))
    doc.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

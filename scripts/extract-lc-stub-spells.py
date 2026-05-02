# -*- coding: utf-8 -*-
"""
Extract German spell descriptions from Liber Cantiones.pdf for spells
whose description contains the stub
'See Liber Cantiones p. N for full German description.'

Writes scripts/_lc_extracted.json
"""
from __future__ import unicode_literals

import io
import json
import os
import re
import sys

try:
    import fitz
except ImportError:
    sys.stderr.write("pip install pymupdf\n")
    sys.exit(1)

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
REF = os.path.join(ROOT, "TDE4_PDF_reference.txt")
SPELLS = os.path.join(ROOT, "data", "magic", "spells.json")
STUB_RE = re.compile(
    r"See Liber Cantiones p\.\s*(\d+)\s+for full German description\.",
    re.I,
)


def parse_pdf_path():
    if not os.path.isfile(REF):
        return os.environ.get("LIBER_CANTIONES_PDF")
    with io.open(REF, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if line.startswith("#") or not line or "=" not in line:
                continue
            key, _, rest = line.partition("=")
            if key.strip() != "liber_cantiones":
                continue
            return rest.strip().strip('"').strip("'")
    return os.environ.get("LIBER_CANTIONES_PDF")


def fix_mojibake(s):
    if not s:
        return s
    try:
        return s.encode("latin1", errors="strict").decode("utf-8", errors="strict")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return s


def load_stub_spells():
    with io.open(SPELLS, "r", encoding="utf-8") as f:
        data = json.load(f)
    spells = data["spells"] if isinstance(data, dict) else data
    out = []
    for sp in spells:
        desc = sp.get("description") or ""
        if "for full German description" not in desc:
            continue
        m = STUB_RE.search(desc)
        if not m:
            continue
        page = int(m.group(1))
        gn = (sp.get("german_name") or sp.get("name") or "").strip()
        out.append(
            {
                "id": sp["id"],
                "name": sp.get("name"),
                "german_name": gn,
                "stub_page": page,
                "complexity_prefix": STUB_RE.sub("", desc).strip(),
            }
        )
    return out


def build_name_to_page(doc, german_uppers):
    """Map UPPER german_name -> first PDF page index containing \\nNAME\\n."""
    found = {}
    for i in range(doc.pageCount):
        t = fix_mojibake(doc[i].getText())
        for gu in german_uppers:
            if gu in found:
                continue
            if "\n%s\n" % gu in t:
                found[gu] = i
    return found


def find_spell_start_page(name_to_page, german_upper):
    p = name_to_page.get(german_upper)
    if p is not None:
        return p
    return name_to_page.get(german_upper.replace("ß", "SS"))


def main():
    pdf = parse_pdf_path()
    if not pdf or not os.path.isfile(pdf):
        sys.stderr.write("Liber Cantiones PDF not found.\n")
        sys.exit(1)

    stubs = load_stub_spells()
    doc = fitz.open(pdf)
    uppers = list({(s["german_name"] or "").upper() for s in stubs})
    name_to_page = build_name_to_page(doc, uppers)

    for sp in stubs:
        gu = (sp["german_name"] or "").upper()
        sp["pdf_page_start"] = find_spell_start_page(name_to_page, gu)

    results = []
    for sp in stubs:
        gu = (sp["german_name"] or "").upper()
        p0 = sp.get("pdf_page_start")
        if p0 is None:
            p0 = sp["stub_page"]
        p_end = min(p0 + 6, doc.pageCount)
        for s2 in stubs:
            p2 = s2.get("pdf_page_start")
            if p2 is not None and p2 > p0:
                p_end = min(p_end, p2)

        parts = []
        for pp in range(p0, p_end):
            parts.append(fix_mojibake(doc[pp].getText()))
        blob = "\n".join(parts)

        needle = "\n%s\n" % gu
        pos = blob.find(needle)
        if pos < 0:
            german = blob.strip()
        else:
            german = blob[: pos + len(needle)].strip()

        results.append(
            {
                "id": sp["id"],
                "name": sp["name"],
                "german_name": sp["german_name"],
                "pdf_page_start": p0,
                "pdf_page_end_exclusive": p_end,
                "german": german,
            }
        )

    out_path = os.path.join(ROOT, "scripts", "_lc_extracted.json")
    with io.open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    sys.stdout.buffer.write(
        ("wrote %s (%d spells)\n" % (out_path, len(results))).encode("utf-8", errors="replace")
    )


if __name__ == "__main__":
    main()

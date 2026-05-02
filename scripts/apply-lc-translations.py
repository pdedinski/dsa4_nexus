# -*- coding: utf-8 -*-
"""Merge _lc_translations.json into data/magic/spells.json descriptions."""
from __future__ import unicode_literals

import io
import json
import os
import re

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SPELLS = os.path.join(ROOT, "data", "magic", "spells.json")
TRANS = os.path.join(ROOT, "scripts", "_lc_translations.json")
STUB_RE = re.compile(
    r"\s*See Liber Cantiones p\.\s*\d+\s+for full German description\.",
    re.I,
)


def main():
    with io.open(TRANS, "r", encoding="utf-8") as f:
        trans = json.load(f)
    with io.open(SPELLS, "r", encoding="utf-8") as f:
        data = json.load(f)
    spells = data["spells"]
    n = 0
    for sp in spells:
        desc = sp.get("description") or ""
        if "for full German description" not in desc:
            continue
        if not STUB_RE.search(desc):
            continue
        sid = sp["id"]
        en = trans.get(sid)
        if not en or en.startswith("[translation failed"):
            continue
        prefix = STUB_RE.sub("", desc).strip()
        sp["description"] = prefix + "\n\n" + en.strip()
        n += 1
    if "meta" in data:
        data["meta"]["description_enrichment"] = (
            "English: Liber Cantiones PDF (local path from TDE4_PDF_reference.txt) "
            "extract + machine translation (DE→EN). Fandom enrichment where previously applied."
        )
    with io.open(SPELLS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("updated %d spell descriptions" % n)


if __name__ == "__main__":
    main()

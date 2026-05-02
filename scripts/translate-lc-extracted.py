# -*- coding: utf-8 -*-
"""
Translate German blocks in _lc_extracted.json to English (Google via deep-translator).
Requires: pip install deep-translator==1.5.0
Output: scripts/_lc_translations.json { id: english }
"""
from __future__ import unicode_literals

import io
import json
import os
import re
import sys
import time

try:
    from deep_translator import GoogleTranslator
except ImportError:
    sys.stderr.write("pip install deep-translator==1.5.0\n")
    sys.exit(1)

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
INP = os.path.join(ROOT, "scripts", "_lc_extracted.json")
OUT = os.path.join(ROOT, "scripts", "_lc_translations.json")

CHUNK = 4200
SLEEP = 0.35


def chunks(text):
    text = text.strip()
    if not text:
        return []
    out = []
    while text:
        if len(text) <= CHUNK:
            out.append(text)
            break
        cut = text.rfind("\n", 0, CHUNK)
        if cut < CHUNK // 2:
            cut = CHUNK
        out.append(text[:cut].strip())
        text = text[cut:].strip()
    return out


def translate_de_en(text):
    tr = GoogleTranslator(source="de", target="en")
    parts = []
    for ch in chunks(text):
        for attempt in range(3):
            try:
                parts.append(tr.translate(ch))
                break
            except Exception as e:
                if attempt == 2:
                    raise
                time.sleep(2.0 * (attempt + 1))
        time.sleep(SLEEP)
    return "\n\n".join(parts)


def main():
    with io.open(INP, "r", encoding="utf-8") as f:
        rows = json.load(f)
    out = {}
    for i, row in enumerate(rows):
        sid = row["id"]
        de = row.get("german") or ""
        if not de.strip():
            out[sid] = ""
            continue
        try:
            en = translate_de_en(de)
        except Exception as e:
            out[sid] = "[translation failed: %s]" % e
            sys.stderr.write("%s: %s\n" % (sid, e))
            continue
        out[sid] = en
        sys.stdout.buffer.write(
            ("[%d/%d] %s\n" % (i + 1, len(rows), sid)).encode("utf-8", errors="replace")
        )
        sys.stdout.flush()

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    sys.stdout.buffer.write(("wrote %s\n" % OUT).encode("utf-8", errors="replace"))


if __name__ == "__main__":
    main()

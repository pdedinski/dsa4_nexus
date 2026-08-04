# -*- coding: utf-8 -*-
"""
Align spell description abbreviations with official English TDE terminology.

Reference: TDE_DSA4_1_German_English_Abbreviations_and_Terminology.txt (project root).

Only touches each spell's "description" string in data/magic/spells.json.
"""
from __future__ import unicode_literals

import io
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SPELLS = os.path.join(ROOT, "data", "magic", "spells.json")


def align_description(s):
    if not s:
        return s
    # --- Points / astral (specific strings first) ---
    s = s.replace("pAsP", "permanent ASP")
    s = s.replace("pASP", "permanent ASP")
    s = s.replace("NDT*", "SP*")
    s = s.replace("ZfP*", "SP*")
    s = s.replace("TaP*", "TP*")
    s = re.sub(r"(?<![a-zA-Z])AsP(?![a-zA-Z])", "ASP", s)
    s = s.replace("Sample:", "Check:")
    # --- Time (German KR/SR → CC-01 CR / GT) ---
    s = re.sub(r"\bKR\b", "CR", s)
    s = re.sub(r"\bSR\b", "GT", s)
    # --- Derived / armor / resistance ---
    s = re.sub(r"\bLeP\b", "VP", s)
    s = re.sub(r"\bAuP\b", "EP", s)
    s = re.sub(r"\bAU\b", "EP", s)
    s = re.sub(r"\bMR\b", "RM", s)
    s = re.sub(r"\bRS\b", "AR", s)
    # --- Attributes: German two-letter → English (CC-01) ---
    s = re.sub(r"\bMU\b", "CO", s)
    # Article fixes after MU → CO
    s = re.sub(r"\ban\s+CO\b", "a CO", s, flags=re.I)
    s = re.sub(r"\ban\s+CL\b", "a CL", s, flags=re.I)
    s = re.sub(r"\ban\s+CN\b", "a CN", s, flags=re.I)
    s = re.sub(r"\ban\s+ST\b", "a ST", s, flags=re.I)
    s = re.sub(r"\bKL\b", "CL", s)
    s = re.sub(r"\bFF\b", "DE", s)
    s = re.sub(r"\bGE\b", "AG", s)
    s = re.sub(r"\bKO\b", "CN", s)
    s = re.sub(r"\bKK\b", "ST", s)
    # Spell Prowess (Zauberfertigkeitswert)
    s = re.sub(r"\bZfW\b", "SP", s)
    s = re.sub(r"\bTaW\b", "TP", s)
    # --- Schadenspunkte "SP" in MT → VP (vitality damage), not Spell Prowess ---
    s = s.replace("the SP caused", "the damage caused")
    s = s.replace("real damage (SP)", "real damage (VP)")
    s = s.replace("suffered SP", "suffered VP")
    s = s.replace("Take SP difficult", "Take VP; a difficult")
    s = re.sub(r"(\d+[dDwW]\d+(?:\+[\d]+)?)\s+SP\b", r"\1 VP", s)
    s = re.sub(r"(\d+[dDwW]\d+\+[^\s\)]{1,12})\s+SP\b", r"\1 VP", s)
    s = re.sub(r"\bSP/GT\b", "VP/GT", s)
    s = re.sub(r"\bSP/CR\b", "VP/CR", s)
    s = re.sub(r"\bSP\(A\)/", "VP(A)/", s)
    # --- Probe / test phrasing ---
    s = re.sub(r"\bmagic test\b", "spell check", s, flags=re.I)
    s = re.sub(r"\bCO test\b", "CO check", s, flags=re.I)
    s = re.sub(r"\bCL test\b", "CL check", s, flags=re.I)
    s = re.sub(r"\bCN test\b", "CN check", s, flags=re.I)
    s = re.sub(r"\bST test\b", "ST check", s, flags=re.I)
    s = re.sub(r"\bGE samples\b", "AG checks", s, flags=re.I)
    s = re.sub(r"\bAG samples\b", "AG checks", s, flags=re.I)
    s = re.sub(r"\bST sample\b", "ST check", s, flags=re.I)
    s = re.sub(r"\bMU sample\b", "CO check", s, flags=re.I)
    s = re.sub(r"\bCH sample\b", "CH check", s, flags=re.I)
    s = re.sub(r"\bCO sample\b", "CO check", s, flags=re.I)
    s = re.sub(r"\bCN sample\b", "CN check", s, flags=re.I)
    s = re.sub(r"\bIN sample\b", "IN check", s, flags=re.I)
    s = re.sub(r"\bCL sample\b", "CL check", s, flags=re.I)
    s = re.sub(r"\bDE sample\b", "DE check", s, flags=re.I)
    s = re.sub(r"\bAG sample\b", "AG check", s, flags=re.I)
    s = re.sub(r"\bCN samples\b", "CN checks", s, flags=re.I)
    s = re.sub(r"\bCC test\b", "ST check", s, flags=re.I)  # KK → ST MT glitch
    s = re.sub(r"\bcontrol samples\b", "control checks", s, flags=re.I)
    s = re.sub(r"\bcontrol sample\b", "control check", s, flags=re.I)
    s = re.sub(r"\bcourage test\b", "CO check", s, flags=re.I)
    s = re.sub(r"\bKO sample\b", "CN check", s, flags=re.I)
    s = s.replace("Probe+", "Check+")
    s = re.sub(r"\bKRs\b", "CRs", s)
    s = re.sub(r"\bSRs\b", "GTs", s)
    s = re.sub(r"\(Sch:", "(Rogue cost:", s)
    # MT "off" for German "ab" (from / at) before spell prowess threshold
    s = re.sub(r";\s*off\s+SP\b", "; from SP", s, flags=re.I)
    s = re.sub(r"\.\s*off\s+SP\b", ". From SP", s, flags=re.I)
    # German Meister (GM) left in MT
    s = s.replace("The \nMeister ", "The \nGM ")
    s = s.replace("the \nMeister ", "the \nGM ")
    s = s.replace("(master decision)", "(GM decision)")
    return s


def main():
    with io.open(SPELLS, "r", encoding="utf-8") as f:
        data = json.load(f)
    spells = data["spells"]
    n = 0
    for sp in spells:
        desc = sp.get("description")
        if not desc or not isinstance(desc, str):
            continue
        newd = align_description(desc)
        if newd != desc:
            sp["description"] = newd
            n += 1
    with io.open(SPELLS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    sys.stdout.write("updated %d spell descriptions\n" % n)


if __name__ == "__main__":
    main()

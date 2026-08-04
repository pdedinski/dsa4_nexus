#!/usr/bin/env python3
"""Parse core_alchemical_recipies.txt into codex JSON files. Python 3.6+."""
from __future__ import print_function

import json
import re
from pathlib import Path

try:
    SRC = Path(r"d:\Misc\RPG\The Dark Eye\TDE4_PDFs\core_alchemical_recipies.txt")
    OUT = Path(__file__).resolve().parents[1] / "data" / "alchemy"
except Exception:
    import os
    SRC = r"d:\Misc\RPG\The Dark Eye\TDE4_PDFs\core_alchemical_recipies.txt"
    OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "alchemy")

SECTION_MAP = {
    "I. SIMPLE ALCHEMY": ("simple_alchemy", "Simple Alchemy"),
    "II. ELIXIRS OF THE VIRTUES": ("virtutica", "Elixirs of the Virtues"),
    "III. OBJECT AND MATERIAL ELIXIRS": ("object_material_elixirs", "Object and Material Elixirs"),
    "IV. POISONS": ("poisons", "Poisons"),
    "V. REMEDIES": ("remedies", "Remedies"),
    "VI. MIND, EMOTION, AND ALTERED STATES": ("mind_emotion_altered_states", "Mind, Emotion, and Altered States"),
    "VII. RARE RESTORATIVE AND TRANSFORMATIVE ELIXIRS": (
        "rare_restorative_transformative",
        "Rare Restorative and Transformative Elixirs",
    ),
    "VIII. BAN POWDERS, SUMMONING AIDS, AND SPIRITUAL PREPARATIONS": (
        "ban_powders_spiritual",
        "Ban Powders, Summoning Aids, and Spiritual Preparations",
    ),
}

# Longer labels first so "Crafting Process" is not matched as "Crafting".
FIELD_RE = re.compile(
    r"^(Crafting Process|Description and effect|Quality-adjusted market guideline|"
    r"Total recipe ingredient cost|Exact total recipe ingredient cost|"
    r"Ingredient price breakdown|Ingredients for the Kukris formula|"
    r"Important limitation|Important rules|Important note|Additional rule|Design rule|"
    r"Quality and effect|Quality tiers|Published benchmark|Successful result|"
    r"Tier limitation|Tier effects|Special rule|Duration of changes|"
    r"Category|Ingredients|Crafting|Description|Effect|Hazard|Shelf life|"
    r"Market price|Availability|Source|"
    r"Quality M|Quality A|Quality B|Quality C|Quality D|Quality E|Quality F|"
    r"Damage|Instability|Wounds|Products|Process|Addiction)"
    r"\s*:\s*(.*)$",
    re.IGNORECASE,
)

TITLE_RE = re.compile(r"^(\d{2})\.\s+(.+?)\s+\(([^)]+)\)\s*$")
TITLE_MULTI_RE = re.compile(r"^(\d{2})\.\s+(.+)$")
GERMAN_PAREN_RE = re.compile(r"^(.*?)\s+\(([^)]+)\)\s*$")

QUALITY_M_EFFECTS_RE = re.compile(
    r"Failed-batch effects?\s+([\d,\s]+(?:or\s+\d+)?)",
    re.IGNORECASE,
)


def slugify(name):
    s = name.lower()
    s = re.sub(r"[/'']", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def collapse(text):
    return re.sub(r"[ \t]+", " ", text).strip()


def join_paras(lines):
    parts = []
    buf = []
    for line in lines:
        if not line.strip():
            if buf:
                parts.append(collapse(" ".join(buf)))
                buf = []
        else:
            buf.append(line.strip())
    if buf:
        parts.append(collapse(" ".join(buf)))
    return "\n\n".join(parts)


def parse_quality_m(text):
    effects = []
    note = None
    m = QUALITY_M_EFFECTS_RE.search(text)
    if m:
        nums = re.findall(r"\d+", m.group(1))
        effects = [int(n) for n in nums]
        after = text[m.end() :].strip().lstrip(";.").strip()
        # Drop a trailing period-only fragment from the effects list sentence
        if after.startswith("\n") or (after and after[0].isupper()):
            note = after.lstrip()
        elif after:
            # Same sentence continuation then later paras
            # Keep full remainder if it has substance beyond "or N."
            cleaned = re.sub(r"^or\s+\d+\.?\s*", "", after, flags=re.I).strip()
            if cleaned:
                note = cleaned
    if not effects:
        nums = re.findall(r"\b(\d{1,2})\b", text)
        cand = [int(n) for n in nums if 1 <= int(n) <= 40]
        if cand and len(cand) >= 2:
            effects = cand
        else:
            note = text
    # Also catch "alternatively..." embedded mid-text
    alt = re.search(r"alternatively\s+.+", text, re.I)
    if alt and (not note or "alternatively" not in note.lower()):
        if note:
            note = note + " " + alt.group(0)
        else:
            note = alt.group(0)
    result = {"effects": effects}
    if note:
        result["note"] = collapse(note.replace("\n\n", " ").replace("\n", " "))
    if not effects:
        result["text"] = text
    return result


def parse_crafting(text):
    location = None
    brewing = None
    analysis = None
    extra = None

    parts = [p.strip() for p in text.split(";")]
    if parts:
        location = parts[0].rstrip(".")
    rest = "; ".join(parts[1:]) if len(parts) > 1 else ""
    if not rest and parts:
        rest = parts[0]

    brew_m = re.search(
        r"([+\-]?\d+(?:\s+to\s+[+\-]?\d+)?(?:\s+or\s+more)?)\s+Brewing"
        r"(?:,\s*reduced to\s+([+\-]?\d+)\s+when\s+([^/]+))?",
        rest or text,
        re.I,
    )
    if brew_m:
        brewing = brew_m.group(1).strip()
        if brew_m.group(2):
            extra = "reduced to %s when %s" % (
                brew_m.group(2),
                brew_m.group(3).strip().rstrip(".,; "),
            )

    ana_m = re.search(
        r"([+\-]?\d+(?:\s+to\s+[+\-]?\d+)?)\s+Analysis",
        rest or text,
        re.I,
    )
    if ana_m:
        analysis = ana_m.group(1).strip()

    if location and ("Brewing" in location or "Analysis" in location):
        loc_m = re.match(r"^([^;+]+?)(?:\s*;|\s*\+|\s*$)", text)
        if loc_m:
            location = loc_m.group(1).strip().rstrip(".")

    out = {}
    if location:
        out["crafting_location"] = location
    if brewing is not None:
        out["brewing_modifier"] = brewing
    if analysis is not None:
        out["analysis_modifier"] = analysis
    if extra:
        out["crafting_note"] = extra
    return out


def parse_quality_prices(text):
    prices = {}
    for m in re.finditer(r"([A-F])\s+([0-9.]+D(?:\s*-\s*[0-9.]+D)?)", text):
        prices[m.group(1)] = m.group(2).replace(" ", "")
    return prices or None


def parse_availability(text):
    text = text.strip().rstrip(".")
    if text.isdigit():
        return int(text)
    return text


def split_name_german(title_body):
    m = GERMAN_PAREN_RE.match(title_body.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return title_body.strip(), None


def normalize_name(eng):
    if eng.isupper() or re.match(r"^[A-Z0-9 /,\-']+$", eng):
        def tc(s):
            small = {"of", "the", "and", "a", "an", "against", "or"}
            words = s.lower().split()
            out = []
            for i, w in enumerate(words):
                if i > 0 and w in small:
                    out.append(w)
                else:
                    out.append(w.capitalize())
            return " ".join(out)
        return " / ".join(tc(p) for p in eng.split(" / "))
    return eng


def parse_recipes(text):
    lines = text.splitlines()

    start = None
    end = None
    for i, line in enumerate(lines):
        if line.strip() == "I. SIMPLE ALCHEMY":
            start = i
        if line.strip() == "END OF CORE RECIPE LIST":
            end = i
            break
    if start is None or end is None:
        raise SystemExit("Could not find recipe section bounds")

    section_slug = None
    recipes = []
    current = None
    current_field = None
    field_lines = []

    def flush_field():
        nonlocal_keys = []  # py36: use outer scope via list trick
        # Use mutable container on outer function attributes instead
        pass

    # Use list wrappers for mutable closure state compatible with py3.6 nonlocal
    state = {
        "section_slug": None,
        "current": None,
        "current_field": None,
        "field_lines": [],
    }

    def flush_field_inner():
        current = state["current"]
        current_field = state["current_field"]
        field_lines = state["field_lines"]
        if current is None or current_field is None:
            state["field_lines"] = []
            state["current_field"] = None
            return
        value = join_paras(field_lines)
        key = current_field
        state["current_field"] = None
        state["field_lines"] = []
        if not value:
            return

        if key == "category":
            current["category_label"] = value.rstrip(".")
            return
        if key in ("ingredients", "ingredients for the kukris formula"):
            current["ingredients"] = value
            return
        if key == "crafting":
            # First sentence = location + modifiers; further sentences = notes
            sentences = re.split(r"(?<=\.)\s+", value, maxsplit=1)
            current.update(parse_crafting(sentences[0]))
            if len(sentences) > 1 and sentences[1].strip():
                note = sentences[1].strip()
                prev = current.get("crafting_note")
                current["crafting_note"] = (prev + "\n\n" if prev else "") + note
            return
        if key == "crafting process":
            current["crafting_process"] = value
            return
        if key in ("description", "description and effect"):
            current["description"] = value
            return
        if key == "effect":
            current["effect"] = value
            return
        if key in ("tier effects", "successful result"):
            prev = current.get("effect")
            current["effect"] = (prev + "\n\n" if prev else "") + value
            return
        if key == "published benchmark":
            prev = current.get("effect")
            current["effect"] = (prev + "\n\n" if prev else "") + "Published benchmark: " + value
            return
        if key == "tier limitation":
            prev = current.get("important_note")
            current["important_note"] = (prev + "\n\n" if prev else "") + value
            return
        if key == "special rule":
            prev = current.get("additional_rule")
            current["additional_rule"] = (prev + "\n\n" if prev else "") + value
            return
        if key == "duration of changes":
            prev = current.get("additional_rule")
            current["additional_rule"] = (prev + "\n\n" if prev else "") + "Duration of changes: " + value
            return
        if key == "addiction":
            prev = current.get("additional_rule")
            current["additional_rule"] = (prev + "\n\n" if prev else "") + "Addiction: " + value
            return
        if key == "hazard":
            current["hazard"] = value
            return
        if key == "shelf life":
            current["shelf_life"] = value.rstrip(".")
            return
        if key in ("important note", "important limitation", "important rules"):
            prev = current.get("important_note")
            current["important_note"] = (prev + "\n\n" if prev else "") + value
            return
        if key == "additional rule":
            current["additional_rule"] = value
            return
        if key == "design rule":
            prev = current.get("additional_rule")
            current["additional_rule"] = (prev + "\n\n" if prev else "") + value
            return
        if key == "market price":
            current["market_price_quality_c"] = value
            return
        if key == "quality-adjusted market guideline":
            prices = parse_quality_prices(value)
            if prices:
                current["quality_adjusted_prices"] = prices
            return
        if key in ("total recipe ingredient cost", "exact total recipe ingredient cost"):
            current["ingredient_cost"] = value.lstrip(": ").strip()
            return
        if key == "availability":
            current["availability"] = parse_availability(value)
            return
        if key == "source":
            current["source"] = value
            return
        if key == "quality m":
            current["quality_m"] = parse_quality_m(value)
            return
        if key.startswith("quality ") and len(key) == 9 and key[-1] in "abcdef":
            q = key[-1].upper()
            tiers = current.setdefault("quality_tiers", [])
            tiers.append({"quality": q, "text": value})
            return
        if key == "quality tiers":
            current["no_standard_block"] = True
            current["quality_tiers_note"] = value
            return
        if key == "quality and effect":
            current["effect"] = value
            return
        if key == "damage":
            current["damage_note"] = value
            return
        if key == "instability":
            current["instability"] = value
            return
        if key == "wounds":
            prev = current.get("additional_rule")
            current["additional_rule"] = (prev + "\n\n" if prev else "") + "Wounds: " + value
            return
        if key == "products":
            current["products"] = value
            return
        if key == "process":
            current["crafting_process"] = value
            return
        if key == "ingredient price breakdown":
            current["ingredient_price_note"] = value
            return
        current[key.replace(" ", "_")] = value

    def flush_recipe_inner():
        flush_field_inner()
        current = state["current"]
        if current is None:
            return
        if current.get("quality_tiers_note") or (
            "no standard recipe block" in (current.get("category_label") or "").lower()
        ):
            current["no_standard_block"] = True
        current["category"] = current.get("_section_slug") or "unknown"
        current.pop("_section_slug", None)
        recipes.append(current)
        state["current"] = None

    i = start
    while i < end:
        line = lines[i]
        stripped = line.strip()

        if stripped in SECTION_MAP:
            flush_recipe_inner()
            state["section_slug"] = SECTION_MAP[stripped][0]
            i += 1
            continue

        if stripped.startswith("====") or stripped == "":
            i += 1
            continue

        title_match = TITLE_RE.match(stripped)
        title_loose = TITLE_MULTI_RE.match(stripped) if not title_match else None

        if title_match or (title_loose and re.match(r"^\d{2}\.", stripped)):
            if title_match:
                num = title_match.group(1)
                body = title_match.group(2) + " (" + title_match.group(3) + ")"
            else:
                num = title_loose.group(1)
                body = title_loose.group(2)
                j = i + 1
                while j < end and not lines[j].strip():
                    j += 1
                if j < end:
                    nxt = lines[j].strip()
                    if nxt.startswith("(") and nxt.endswith(")"):
                        body = body + " " + nxt
                        i = j
                    elif (
                        not FIELD_RE.match(nxt)
                        and not re.match(r"^\d{2}\.", nxt)
                        and "(" in nxt
                    ):
                        body = body + " " + nxt
                        i = j

            flush_recipe_inner()
            eng, ger = split_name_german(body)
            name = normalize_name(eng)
            rid = slugify(name)
            current = {
                "id": rid,
                "number": int(num),
                "name": name,
                "_section_slug": state["section_slug"],
            }
            if ger:
                current["german_name"] = ger
            state["current"] = current
            state["current_field"] = None
            state["field_lines"] = []
            i += 1
            continue

        fm = FIELD_RE.match(stripped)
        if fm and state["current"] is not None:
            flush_field_inner()
            state["current_field"] = fm.group(1).lower()
            rest = fm.group(2) or ""
            state["field_lines"] = [rest] if rest else []
            i += 1
            continue

        if state["current"] is not None and state["current_field"] is not None:
            state["field_lines"].append(stripped)
            i += 1
            continue

        i += 1

    flush_recipe_inner()
    return recipes


def parse_failure_table(text):
    lines = text.splitlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if "FAILED-BATCH EFFECTS" in line:
            start = i
        if start is not None and line.strip() == "I. SIMPLE ALCHEMY":
            end = i
            break
    assert start is not None and end is not None

    intro_lines = []
    effects = []
    current_num = None
    current_lines = []
    source = None
    effect_start_re = re.compile(r"^(\d{1,2})\.\s+(.*)$")
    in_effects = False

    def flush_effect():
        nonlocal_dummy = None
        pass

    # py36: use list for mutable
    st = {"num": None, "lines": [], "in_effects": False}

    def flush():
        if st["num"] is None:
            return
        effects.append({"number": st["num"], "effect": join_paras(st["lines"])})
        st["num"] = None
        st["lines"] = []

    for line in lines[start + 1 : end]:
        stripped = line.strip()
        if stripped.startswith("===="):
            continue
        if stripped.startswith("Source:"):
            flush()
            source = stripped[len("Source:") :].strip()
            continue
        m = effect_start_re.match(stripped)
        if m and 1 <= int(m.group(1)) <= 40:
            num = int(m.group(1))
            if not st["in_effects"] and num == 1:
                st["in_effects"] = True
            if st["in_effects"]:
                flush()
                st["num"] = num
                st["lines"] = [m.group(2)]
                continue
        if st["in_effects"] and st["num"] is not None:
            if stripped:
                st["lines"].append(stripped)
        elif not st["in_effects"]:
            if stripped:
                intro_lines.append(stripped)

    flush()
    return {
        "meta": {
            "schema_version": "1.0",
            "last_updated": "2026-08-04",
            "description": "Failed-batch effects (Quality M) for alchemical recipes from Wege der Alchimie.",
            "source_books": ["Wege der Alchimie (2012), pp. 34-35"],
        },
        "intro_note": join_paras(intro_lines),
        "failure_effects": effects,
        "source": source or "Wege der Alchimie (2012), pp. 34-35.",
    }


def parse_price_lists(text):
    lines = text.splitlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if "APPENDIX A. OFFICIAL ALCHEMICAL MATERIAL PRICE LISTS" in line:
            start = i
        if start is not None and "APPENDIX B." in line:
            end = i
            break
    assert start is not None and end is not None

    currency_note = None
    unit_default = None
    sections = []
    current = None
    body_lines = []
    section_re = re.compile(r"^(A\d)\.\s+(.+)$")

    def flush_section():
        if current is None:
            return
        full = join_paras(body_lines)
        source = None
        note_parts = []
        entries = []

        src_m = re.search(r"\n?Source:\s*(.+)$", full, re.I)
        if src_m:
            source = src_m.group(1).strip()
            full = full[: src_m.start()].strip()

        chunks = re.split(r";\s*", full)
        for chunk in chunks:
            chunk = chunk.strip().rstrip(".")
            if not chunk:
                continue
            price_m = re.search(
                r"^(.+?)\s+((?:about\s+)?(?:at least\s+)?"
                r"[0-9][0-9.,]*(?:\s*-\s*[0-9][0-9.,]*)?"
                r"(?:\s*D|\s*T|\s*F|\s*K)"
                r"(?:/[a-zA-Z\- ]+)?"
                r"(?:(?:\s+or\s+more)|(?:\s+or\s+[0-9].+?)|"
                r"(?:\s*,\s*up to\s+[0-9].+?)|"
                r"(?:\s+to\s+(?:well over\s+)?[0-9].+?)|"
                r"(?:\s+among\s+.+?))?"
                r"(?:\s+per\s+.+?)?"
                r")$",
                chunk,
            )
            if price_m:
                item = price_m.group(1).strip()
                price = price_m.group(2).strip()
                if len(item) > 80 and " " in item and item[0].islower():
                    note_parts.append(chunk)
                else:
                    entries.append({"item": item, "price": price})
            else:
                note_parts.append(chunk)

        current["entries"] = entries
        if note_parts:
            current["note"] = " ".join(note_parts)
        if source:
            current["source"] = source
        sections.append(current)

    # Need rebind for current/body_lines — use dict
    st = {"current": None, "body": []}

    def flush():
        cur = st["current"]
        if cur is None:
            return
        full = join_paras(st["body"])
        source = None
        note_parts = []
        entries = []
        src_m = re.search(r"\n?Source:\s*(.+)$", full, re.I)
        if src_m:
            source = src_m.group(1).strip()
            full = full[: src_m.start()].strip()
        price_re = re.compile(
            r"^(.+?)\s+((?:about\s+)?(?:at least\s+)?"
            r"[0-9][0-9.,]*(?:\s*-\s*[0-9][0-9.,]*)?"
            r"(?:\s*D|\s*T|\s*F|\s*K)"
            r"(?:/[a-zA-Z\- ]+)?"
            r"(?:(?:\s+or\s+more)|(?:\s+or\s+[0-9].+?)|"
            r"(?:\s*,\s*up to\s+[0-9].+?)|"
            r"(?:\s+to\s+(?:well over\s+)?[0-9].+?)|"
            r"(?:\s+among\s+.+?))?"
            r"(?:\s+per\s+.+?)?"
            r")(?:\.\s+(.+))?$"
        )
        for chunk in re.split(r";\s*", full):
            chunk = chunk.strip().rstrip(".")
            if not chunk:
                continue
            price_m = price_re.match(chunk)
            if price_m:
                item = price_m.group(1).strip()
                price = price_m.group(2).strip()
                trailing = (price_m.group(3) or "").strip()
                if len(item) > 80 and " " in item and item[0].islower():
                    note_parts.append(chunk)
                else:
                    entries.append({"item": item, "price": price})
                    if trailing:
                        note_parts.append(trailing)
            else:
                note_parts.append(chunk)
        cur["entries"] = entries
        if note_parts:
            cur["note"] = " ".join(note_parts)
        if source:
            cur["source"] = source
        sections.append(cur)
        st["current"] = None
        st["body"] = []

    for line in lines[start + 1 : end]:
        stripped = line.strip()
        if stripped.startswith("====") or not stripped:
            continue
        if stripped.startswith("Currency:"):
            currency_note = stripped
            continue
        if stripped.startswith("Unless another unit"):
            unit_default = stripped
            continue
        sm = section_re.match(stripped)
        if sm:
            flush()
            sid = sm.group(1)
            title = sm.group(2).strip()
            unit_note = None
            if " - " in title:
                title, unit_note = title.split(" - ", 1)
            cur = {"id": sid, "title": title.strip()}
            if unit_note:
                cur["unit_note"] = unit_note.strip()
            st["current"] = cur
            st["body"] = []
            continue
        if st["current"] is not None:
            st["body"].append(stripped)

    flush()

    return {
        "meta": {
            "schema_version": "1.0",
            "last_updated": "2026-08-04",
            "description": "Official alchemical material price lists from Wege der Alchimie and selected plant prices from Zoo-Botanica Aventurica.",
            "source_books": [
                "Wege der Alchimie (2012), pp. 206, 208-209",
                "Zoo-Botanica Aventurica, Herbarium pp. 227-275",
            ],
        },
        "currency_note": currency_note
        or "Currency: 1 ducat (D) = 10 thalers (T) = 100 farthings (F) = 1,000 kreutzers (K).",
        "unit_default": unit_default
        or "Unless another unit is stated, the price is per stone. These are ingredient unit prices, not recipe package totals.",
        "price_sections": sections,
    }


def main():
    text = Path(SRC).read_text(encoding="utf-8")
    out_dir = Path(OUT)
    out_dir.mkdir(parents=True, exist_ok=True)

    recipes = parse_recipes(text)
    seen = {}
    for r in recipes:
        rid = r["id"]
        if rid in seen:
            seen[rid] += 1
            r["id"] = "%s_%d" % (rid, seen[rid])
        else:
            seen[rid] = 1

    recipes_doc = {
        "meta": {
            "schema_version": "1.0",
            "last_updated": "2026-08-04",
            "description": "Core alchemical recipes from Wege der Alchimie (2012), Recipes of Aventuria chapter. Includes Witches' Flying Ointment and Metallurgical Additives which lack standard recipe blocks. Quality M references the Failed-Batch Effects table.",
            "source_books": [
                "Wege der Alchimie (2012), pp. 33-64, 202-203, 208-209",
                "Zoo-Botanica Aventurica, Herbarium pp. 227-275",
            ],
            "quality_price_multipliers": {
                "description": "Quality C is the base market price. Relative multipliers compound from C.",
                "A": 0.64,
                "B": 0.80,
                "C": 1.00,
                "D": 1.50,
                "E": 2.25,
                "F": 3.375,
            },
        },
        "recipes": recipes,
    }

    failure = parse_failure_table(text)
    prices = parse_price_lists(text)

    (out_dir / "recipes.json").write_text(
        json.dumps(recipes_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "failure_table.json").write_text(
        json.dumps(failure, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "ingredient_prices.json").write_text(
        json.dumps(prices, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Recipes: %d" % len(recipes))
    by_cat = {}
    for r in recipes:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
    for k in sorted(by_cat.keys()):
        print("  %s: %d" % (k, by_cat[k]))
    print("Failure effects: %d" % len(failure["failure_effects"]))
    print("Price sections: %d" % len(prices["price_sections"]))
    for s in prices["price_sections"]:
        print("  %s %s: %d entries" % (s["id"], s["title"], len(s.get("entries", []))))

    for n in (1, 10, 23, 25, 44, 77):
        r = next((x for x in recipes if x["number"] == n), None)
        if r:
            print("#%d %s (%s) cat=%s" % (n, r["name"], r.get("german_name"), r["category"]))
            print("  keys: %s" % sorted(r.keys()))


if __name__ == "__main__":
    main()

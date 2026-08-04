#!/usr/bin/env python3
"""
Parse Wege der Helden base profession profiles into data/core/professions.json.

Phase 1: parent/base profiles only (variants reserved as empty arrays).
Reads the English extract and emits English-only fields (german_name excepted),
using project talent ids and terminology conventions.

Usage:
  python scripts/parse_wdh_professions_base.py
"""
from __future__ import print_function

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SRC = Path(
    r"d:\Misc\RPG\The Dark Eye\TDE4_PDFs\Wege_der_Helden_Professions_English_Complete(3).txt"
)
OUT = REPO / "data" / "core" / "professions.json"
CONCEPT_WEIGHTS = REPO / "data" / "concepts" / "concept_weights.json"
OLD_PROFESSIONS = REPO / "data" / "core" / "professions.brw_backup.json"

CATEGORY_MAP = {
    "Combat Professions": "combat",
    "Traveling And Wilderness Professions": "traveling_wilderness",
    "Traveling and Wilderness Professions": "traveling_wilderness",
    "Socially Oriented Professions": "social",
    "Craft And Knowledge Professions": "craft_knowledge",
    "Craft and Knowledge Professions": "craft_knowledge",
    "Magical Professions": "magical",
    "Divine And Animistic Professions": "divine_animistic",
    "Divine and Animistic Professions": "divine_animistic",
}

# WdH English slug -> preserve existing character professionId
LEGACY_ID_REMAP = {
    "courier": "messenger",
    "entertainer": "mountebank",
    "chirurgeon": "physician",
    "guild_magician": "magician",
    "standard_guild_magician": "magician",
}

# Display names for remapped legacy ids (keep UI recognizable)
LEGACY_DISPLAY_NAME = {
    "messenger": "Courier",
    "mountebank": "Entertainer",
    "physician": "Chirurgeon",
    "magician": "Guild Magician",
}

# Seed generation weights from closest legacy concept (by affinity_tags)
CATEGORY_DEFAULT_CONCEPT = {
    "combat": "combat_frontliner",
    "traveling_wilderness": "wilderness",
    "social": "social",
    "craft_knowledge": "craftsman_blacksmith",
    "magical": "magical_guild",
    "divine_animistic": "healer",
}

AFFINITY_FROM_CATEGORY = {
    "combat": ["combat_frontliner"],
    "traveling_wilderness": ["wilderness"],
    "social": ["social"],
    "craft_knowledge": ["commoner"],
    "magical": ["magical_guild"],
    "divine_animistic": ["healer", "scholar"],
}

# Talent display names / WdH synonyms -> catalog ids
TALENT_ALIASES = {
    "daggers": "daggers",
    "dagger": "daggers",
    "jousting": "jousting",
    "brawling": "brawling",
    "wrestling": "wrestling",
    "sabers": "sabers",
    "saber": "sabers",
    "swords": "swords",
    "sword": "swords",
    "spears": "spears",
    "spear": "spears",
    "axes and maces": "axes_and_maces",
    "axes & maces": "axes_and_maces",
    "bastard sword": "bastard_sword",
    "bastard swords": "bastard_sword",
    "zweihand swords": "two_handed_swords",
    "zweihandschwerter": "two_handed_swords",
    "zweihandschwerter/sabre": "two_handed_swords",
    "zweihand swords/-sabre": "two_handed_swords",
    "two-handed swords": "two_handed_swords",
    "two handed swords": "two_handed_swords",
    "two-handed blunt weapons": "two_handed_blunt_weapons",
    "two handed blunt weapons": "two_handed_blunt_weapons",
    "two-handed flails": "two_handed_flails",
    "two-handed maces": "two_handed_blunt_weapons",
    "infantry weapons": "infantry_weapons",
    "fencing weapons": "fencing_weapons",
    "chain weapons": "chain_weapons",
    "chain staves": "chain_staves",
    "crossbow": "crossbows",
    "crossbows": "crossbows",
    "bow": "bows",
    "bows": "bows",
    "javelins": "throwing_spears",
    "javelin": "throwing_spears",
    "throwing knives": "throwing_knives",
    "throwing knife": "throwing_knives",
    "throwing axes": "throwing_axes",
    "throwing axe": "throwing_axes",
    "throwing spears": "throwing_spears",
    "staves": "staves",
    "staff": "staves",
    "whip": "whip",
    "siege weapons": "siege_weapons",  # may not exist — noted
    "sling": "sling",
    "blowpipe": "blowpipe",
    "discus": "discus",
    "athletics": "athletics",
    "climb": "climb",
    "climbing": "climb",
    "body control": "body_control",
    "ride": "ride",
    "willpower": "self_control",
    "self-control": "self_control",
    "self control": "self_control",
    "perception": "perception",
    "swim": "swim",
    "swimming": "swim",
    "acrobatics": "acrobatics",
    "carouse": "carouse",
    "dance": "dance",
    "sing": "sing",
    "sneak": "sneak",
    "hide": "hide",
    "juggling": "juggling",
    "pick pockets": "pick_pockets",
    "pickpocket": "pick_pockets",
    "voice mimicry": "voice_mimicry",
    "skiing": "skiing",  # may not exist
    "etiquette": "etiquette",
    "streetwise": "streetwise",
    "human nature": "human_nature",
    "fast talk": "fast_talk",
    "persuade": "persuade",
    "seduce": "seduce",
    "teach": "teach",
    "masquerade": "masquerade",
    "disguise": "masquerade",
    "written expression": "written_expression",  # may not exist
    "orientation": "orientation",
    "track": "track",
    "tracking": "track",
    "trap": "trap",
    "trapping": "trap",
    "fish": "fish",
    "fishing": "fish",
    "weather sense": "weather_sense",
    "survival": "survival",
    "wilderness living": "survival",
    "bind/escape": "bind_escape",
    "bind escape": "bind_escape",
    "binding/escape": "bind_escape",
    "religious lore": "religious_lore",
    "warcraft": "warcraft",
    "history": "history",
    "heraldry": "heraldry",
    "calculate": "calculate",
    "law": "law",
    "legend lore": "legend_lore",
    "legends": "legend_lore",
    "geography": "geography",
    "arcane lore": "arcane_lore",
    "magic lore": "arcane_lore",
    "animal lore": "animal_lore",
    "plant lore": "plant_lore",
    "board games": "board_games",
    "anatomy": "anatomy",
    "appraise": "appraise",
    "engineering": "engineering",
    "light engineering": "light_engineering",
    "mechanics": "light_engineering",
    "fine mechanics": "light_engineering",
    "language lore": "language_lore",
    "starcraft": "starcraft",
    "stone lore": "stone_lore",
    "statecraft": "statecraft",  # may not exist
    "philosophy": "philosophy",  # may not exist
    "treat wounds": "treat_wounds",
    "heal wounds": "treat_wounds",
    "treat poison": "treat_poison",
    "heal poison": "treat_poison",
    "treat disease": "treat_disease",
    "heal disease": "treat_disease",
    "leathercraft": "leathercraft",
    "leatherwork": "leathercraft",
    "cartography": "cartography",
    "paint/draw": "paint_draw",
    "paint draw": "paint_draw",
    "drawing/painting": "paint_draw",
    "play instrument": "play_instrument",
    "music": "play_instrument",
    "boats": "boats",
    "boating": "boats",
    "seafaring": "seafaring",
    "drive": "drive",
    "vehicle driving": "drive",
    "cook": "cook",
    "cooking": "cook",
    "tailor": "tailor",
    "tailoring": "tailor",
    "woodcraft": "woodcraft",
    "woodworking": "woodcraft",
    "blacksmith": "blacksmith",
    "blacksmithing": "blacksmith",
    "alchemy": "alchemy",
    "animal training": "animal_training",
    "train animals": "animal_training",
    "bowyer": "bowyer",
    "bowcraft": "bowyer",
    "farming": "farming",
    "mining": "mining",
    "pick locks": "pick_locks",
    "lockpicking": "pick_locks",
    "cheat": "cheat",
    "cheating": "cheat",
    "carpenter": "carpenter",
    "stonemason": "stonemason",
    "stonemasonry": "stonemason",
    "stonecutter/jeweler": "stonecutter_jeweler",
    "tattoo": "tattoo",
    "tattooing": "tattoo",
    "butcher": "butcher",
    "tanner/furrier": "tanner_furrier",
    "pottery": "pottery",  # may not exist
    "flint working": "flint_working",  # may not exist
    "treat soul": "treat_soul",  # may not exist
}

KNOWN_TALENT_IDS = set()

ATTRS = ("CO", "CL", "IN", "CH", "DE", "AG", "CN", "ST")

FIELD_LABELS = (
    "Requirements",
    "Requirement",
    "Additional Requirements",
    "Adjustments",
    "Adjustment",
    "Automatic Advantages and Disadvantages",
    "Automatic Advantages",
    "Automatic Disadvantages",
    "Recommended Advantages and Disadvantages",
    "Recommended Advantages",
    "Recommended Disadvantages",
    "Recommended and Unsuitable Advantages and Disadvantages",
    "Unsuitable Advantages and Disadvantages",
    "Unsuitable Advantages",
    "Unsuitable Disadvantages",
    "Combat Talents",
    "Physical Talents",
    "Social Talents",
    "Nature Talents",
    "Lore Talents",
    "Languages and Scripts",
    "Artisan Talents",
    "Special Abilities",
    "Special Ability",
    "Discounted Special Abilities",
    "Discounted Special Ability",
    "Equipment",
    "Special Possession",
    "Liturgies",
    "Discounted Liturgies",
    "Spells",
    "Starting Spells",
    "Usual Culture",
    "Usual Cultures",
)


def slugify(name):
    s = name.lower()
    s = s.replace("'", "").replace("'", "").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def collapse(text):
    return re.sub(r"[ \t]+", " ", text).strip()


def load_talent_catalog():
    global KNOWN_TALENT_IDS
    talent_dir = REPO / "data" / "talents"
    ids = set()
    for path in talent_dir.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        # find array of talents
        for key, val in data.items():
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, dict) and "id" in item:
                        ids.add(item["id"])
    KNOWN_TALENT_IDS = ids
    return ids


def resolve_talent(name):
    n = collapse(name).lower()
    n = n.replace("(l)", "").strip()
    n = re.sub(r"\s+", " ", n)
    if n in TALENT_ALIASES:
        tid = TALENT_ALIASES[n]
        return tid if tid in KNOWN_TALENT_IDS or tid else None
    # slugify fallback
    tid = slugify(n)
    if tid in KNOWN_TALENT_IDS:
        return tid
    # try without trailing punctuation
    tid2 = slugify(re.sub(r"[^a-z0-9\s]+", "", n))
    if tid2 in KNOWN_TALENT_IDS:
        return tid2
    return None


def split_adv_dis(line):
    """Split 'A, B / C, D' into advantages and disadvantages lists (text)."""
    if not line or line.strip() in ("-", "—", ""):
        return [], []
    parts = re.split(r"\s/\s", line, maxsplit=1)
    adv = [collapse(x) for x in parts[0].split(",") if collapse(x) and collapse(x) != "-"]
    dis = []
    if len(parts) > 1:
        dis = [collapse(x) for x in parts[1].split(",") if collapse(x) and collapse(x) != "-"]
    return adv, dis


def trait_id_guess(text):
    """Best-effort English trait name -> snake id (notes preserve original)."""
    t = collapse(text)
    # strip ratings like (12; ...) or 5 or (10)
    base = re.sub(r"\s*\(.*$", "", t)
    base = re.sub(r"\s+\d+\s*$", "", base)
    return slugify(base), t


def parse_requirements(text):
    reqs = []
    notes = []
    if not text or text.strip() in ("-", "depending on style"):
        if text and "depending" in text.lower():
            notes.append("Requirements: " + collapse(text))
        return reqs, notes

    # Attr mins: CO 13, AG 12
    for m in re.finditer(r"\b(" + "|".join(ATTRS) + r")\s+(\d+)\b", text):
        reqs.append({"type": "attr_min", "attr": m.group(1), "value": int(m.group(2))})

    # women only / men only
    low = text.lower()
    if "women only" in low or "female only" in low:
        reqs.append({"type": "gender_note", "note": "women only"})
    if "men only" in low or "male only" in low:
        reqs.append({"type": "gender_note", "note": "men only"})

    # Culture: X
    cm = re.search(r"Culture[:\s]+([^;]+)", text, re.I)
    if cm:
        cult = collapse(cm.group(1))
        # may list multiple
        for piece in re.split(r",| or |/", cult):
            piece = collapse(piece)
            if piece and piece.lower() not in ("any", "depending on style"):
                reqs.append({"type": "culture_note", "culture": piece})

    # Race hints
    if re.search(r"\bdwarfs?\s+only\b", text, re.I):
        reqs.append({"type": "race", "race": "dwarf"})
    if re.search(r"\belves?\s+only\b|\belf\s+only\b", text, re.I):
        reqs.append({"type": "race", "race": "elf"})

    leftover = text
    # Keep a note if lots of non-attr content
    cleaned = re.sub(r"\b(" + "|".join(ATTRS) + r")\s+\d+\b", "", leftover)
    cleaned = re.sub(r"(women|men|female|male)\s+only", "", cleaned, flags=re.I)
    cleaned = re.sub(r"Culture[:\s]+[^;]+", "", cleaned, flags=re.I)
    cleaned = collapse(cleaned.replace(";", " ").replace(",", " "))
    if len(cleaned) > 8 and cleaned.lower() not in ("-",):
        notes.append("Requirements extras: " + cleaned)

    return reqs, notes


def parse_adjustments(text, reqs):
    derived = {}
    notes = []
    if not text or text.strip() in ("-", "depending on style"):
        if text and "depending" in text.lower():
            notes.append("Adjustments: " + collapse(text))
        return derived, notes

    # VP +1, EP +3, ASP +12, RM +2, KP …
    for m in re.finditer(
        r"\b(VP|EP|ASP|RM|KP)\s*\+?\s*(\d+)\b", text, re.I
    ):
        key = m.group(1).upper()
        if key == "KP":
            notes.append("KP +" + m.group(2) + " (karmic; stored as note)")
            continue
        derived[key] = int(m.group(2))

    # +2 EP style
    for m in re.finditer(r"\+(\d+)\s+(VP|EP|ASP|RM)\b", text, re.I):
        derived[m.group(2).upper()] = int(m.group(1))

    # SO 5-10
    sm = re.search(r"\bSO\s*(\d+)\s*[-–—]\s*(\d+)\b", text, re.I)
    if sm:
        reqs.append(
            {"type": "SO_range", "min": int(sm.group(1)), "max": int(sm.group(2))}
        )

    return derived, notes


def parse_talent_clause(clause, talent_mods, choice_mods, notes):
    """Parse one talent clause like 'Sabers or Swords +6' or 'Ride +5' or 'no Ride'."""
    clause = collapse(clause)
    if not clause or clause in ("-", "—"):
        return

    # "no X" / "no Leathercraft"
    nm = re.match(r"^no\s+(.+)$", clause, re.I)
    if nm:
        tid = resolve_talent(nm.group(1))
        if tid:
            talent_mods[tid] = 0  # marker; generator treats as package value — better omit
            notes.append("Talent removal (no %s) — omitted from flat mods" % nm.group(1))
        else:
            notes.append("Unrecognized talent removal: " + clause)
        if tid in talent_mods:
            del talent_mods[tid]
        return

    # "the other +N" — unresolved
    if re.search(r"\bthe other\b", clause, re.I):
        notes.append("Unresolved talent clause: " + clause)
        return

    # value at end: +6 or -1 or + 2
    vm = re.search(r"([+-]\s*\d+)\s*$", clause)
    if not vm:
        notes.append("Talent clause without value: " + clause)
        return
    value = int(vm.group(1).replace(" ", ""))
    left = collapse(clause[: vm.start()])

    # split on or / o.
    parts = re.split(r"\s+or\s+|\s+o\.\s+", left, flags=re.I)
    parts = [collapse(p) for p in parts if collapse(p)]
    if not parts:
        return

    ids = []
    unresolved = []
    for p in parts:
        tid = resolve_talent(p)
        if tid:
            ids.append(tid)
        else:
            unresolved.append(p)

    if unresolved:
        notes.append("Unrecognized talent name(s): " + ", ".join(unresolved) + " in: " + clause)

    if len(ids) == 1 and not unresolved:
        talent_mods[ids[0]] = talent_mods.get(ids[0], 0) + value
    elif len(ids) >= 2:
        choice_mods.append({"choose": 1, "from": ids, "value": value})
    elif unresolved and not ids:
        notes.append("Dropped talent clause: " + clause)


def parse_talent_line(text, talent_mods, choice_mods, notes):
    if not text or text.strip() in ("-", "—"):
        return
    # Split on commas / semicolons, but keep "or" groups together
    # Also handle "Talents:" prefix leftovers
    text = re.sub(r"^Talents:\s*", "", text, flags=re.I)
    # Split carefully: commas that aren't inside brackets
    chunks = []
    buf = []
    depth = 0
    for ch in text:
        if ch in "[(":
            depth += 1
        elif ch in "])":
            depth = max(0, depth - 1)
        if ch in ",;" and depth == 0:
            chunks.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        chunks.append("".join(buf))

    for chunk in chunks:
        parse_talent_clause(chunk, talent_mods, choice_mods, notes)


def parse_sa_line(text, automatic=True):
    """Return list of {id, note?} from SA line."""
    if not text or text.strip() in ("-", "—"):
        return []
    items = []
    for part in re.split(r",|;", text):
        part = collapse(part)
        if not part or part.lower().startswith("according to"):
            continue
        # "no Shield Fighting I" — skip removals for automatic list
        if part.lower().startswith("no "):
            continue
        # Liturgy Knowledge etc. — keep as note-heavy id
        base = re.sub(r"\s*\(.*\)$", "", part)
        tid = slugify(base)
        note = None
        pm = re.search(r"\((.+)\)\s*$", part)
        if pm:
            note = collapse(pm.group(1))
        entry = {"id": tid}
        if note:
            entry["note"] = note
        items.append(entry)
    return items


def parse_equipment(text):
    if not text or text.strip() in ("-", "—"):
        return []
    items = []
    for part in re.split(r",|;", text):
        part = collapse(part)
        if part:
            items.append(part)
    return items


def parse_header_line(line):
    """
    'Amazon (Amazone) (10 GP; time-consuming) Source page: 96.'
    'Courier / Courier (Botenreiter / Botenreiterin) (0 GP) Source page: 123.'
    """
    line = collapse(line)
    gp = None
    time_consuming = False
    source_page = None
    data_notes = []

    gm = re.search(r"\(([^)]*GP[^)]*)\)", line, re.I)
    if gm:
        gtext = gm.group(1)
        if re.search(r"depending|according", gtext, re.I):
            gp = None
            data_notes.append("GP cost depends on academy/style/variant: " + gtext)
        else:
            nm = re.search(r"(\d+)\s*GP", gtext, re.I)
            if nm:
                gp = int(nm.group(1))
        if re.search(r"time-consuming|time consuming", gtext, re.I):
            time_consuming = True

    # Also catch time-consuming outside GP paren
    if re.search(r"time-consuming|time consuming", line, re.I):
        time_consuming = True

    sp = re.search(r"Source page:\s*([\d\-–]+)", line, re.I)
    if sp:
        source_page = sp.group(1)

    # Name / German
    before = line
    if gm:
        before = line[: gm.start()].strip()
    before = re.sub(r"\s*Source page:.*$", "", before, flags=re.I).strip()

    english = before
    german = None
    # Prefer last parenthetical as german if present before GP
    # Pattern: English (German) or En / En (Ge / Ge)
    pm = re.search(r"^(.*?)\s+\(([^)]+)\)\s*$", before)
    if pm:
        english = collapse(pm.group(1))
        german = collapse(pm.group(2))
        # If english still has slash pairs, take first
        if " / " in english:
            english = english.split(" / ")[0].strip()
        if german and " / " in german:
            # take masculine or first
            german = german.split(" / ")[0].strip()

    # Clean english of remaining parens
    english = re.sub(r"\s*\([^)]*\)\s*", " ", english).strip()
    if " / " in english:
        english = english.split(" / ")[0].strip()
    # Strip curly/smart quotes and odd punctuation from names
    english = english.strip(" \t\"'`‘’“”")
    if german:
        german = german.strip(" \t\"'`‘’“”")

    return {
        "name": english,
        "german_name": german,
        "gp_cost": gp,
        "time_consuming": time_consuming,
        "source_page": source_page,
        "header_notes": data_notes,
    }


def extract_fields(block):
    """Parse labeled fields from a base profile body."""
    labels_pat = "|".join(re.escape(l) for l in sorted(FIELD_LABELS, key=len, reverse=True))
    # Split into labeled segments
    pattern = re.compile(r"(?:^|\n)(" + labels_pat + r")\s*:\s*", re.I)
    parts = pattern.split(block)
    fields = {}
    # parts[0] is preamble (header line), then label, value, label, value...
    preamble = parts[0].strip()
    i = 1
    while i + 1 < len(parts):
        label = collapse(parts[i])
        # normalize label key
        value = parts[i + 1]
        # cut value at next structural marker
        value = re.split(
            r"\n\[VARIANT|\nEND OF ENTRY|\nSOURCE STRUCTURE|\nPARENT AND",
            value,
            maxsplit=1,
        )[0]
        fields[label] = collapse(value.replace("\n", " "))
        i += 2
    return preamble, fields


def get_field(fields, *names):
    for n in names:
        for k, v in fields.items():
            if k.lower() == n.lower():
                return v
    return ""


def section_category(chunk):
    m = re.search(r"^Category:\s*(.+)$", chunk, re.M)
    if not m:
        return "combat"
    raw = collapse(m.group(1))
    return CATEGORY_MAP.get(raw, slugify(raw))


def section_description(chunk):
    m = re.search(
        r"DESCRIPTION\n[-]+\n(.*?)(?:\nPARENT AND VARIANT|\nCOMPLETE PUBLISHED)",
        chunk,
        re.S,
    )
    if not m:
        return ""
    return collapse(m.group(1).replace("\n", " "))


def build_profession(section_num, title, category, description, base_block, stub=False):
    notes = []
    if stub:
        header = {
            "name": title.split("(")[0].strip(),
            "german_name": None,
            "gp_cost": None,
            "time_consuming": False,
            "source_page": None,
            "header_notes": ["No generic base stat block in WdH; structural heading only."],
        }
        gm = re.search(r"\(([^)]+)\)\s*$", title.strip())
        if gm:
            header["german_name"] = collapse(gm.group(1))
        # Prefer SOURCE STRUCTURE note body as description supplement
        desc = description
        sm = re.search(
            r"SOURCE STRUCTURE[^\n]*\n(.*?)(?:\nEND OF ENTRY|\n\[|\Z)",
            base_block,
            re.S,
        )
        if sm:
            desc = (desc + " " + collapse(sm.group(1).replace("\n", " "))).strip()
        pid = slugify(header["name"])
        return OrderedDict(
            [
                ("id", pid),
                ("name", header["name"]),
                ("german_name", header["german_name"]),
                ("category", category),
                ("gp_cost", None),
                ("time_consuming", False),
                ("requirements", []),
                ("derived_modifiers", {}),
                ("automatic_advantages", []),
                ("automatic_disadvantages", []),
                ("recommended_traits", {"advantages": [], "disadvantages": []}),
                ("unsuitable_traits", {"advantages": [], "disadvantages": []}),
                ("choice_blocks", []),
                ("talent_modifiers", {}),
                ("talent_choice_modifiers", []),
                ("automatic_SAs", []),
                ("discounted_SAs", []),
                ("starting_equipment", []),
                ("special_possession", None),
                ("magical_status", "none"),
                ("spell_modifiers", {}),
                ("affinity_tags", AFFINITY_FROM_CATEGORY.get(category, [])),
                ("talent_group_weights", {}),
                ("talent_bias", {}),
                ("talent_avoid_bias", {}),
                ("attribute_bias", {}),
                ("advantage_pick_bias", {}),
                ("disadvantage_pick_bias", {}),
                ("at_pa_bias", "balanced"),
                ("spell_group_weight", 0.0),
                ("variants", []),
                ("description", desc),
                ("source", "WdH (structural heading)"),
                ("data_complete", False),
                ("data_notes", "; ".join(header["header_notes"])),
                ("description_format", "plain_text_paragraphs"),
            ]
        )

    preamble, fields = extract_fields(base_block)
    # First non-empty line of preamble is the header
    header_line = ""
    for ln in preamble.splitlines():
        if collapse(ln):
            header_line = collapse(ln)
            break
    header = parse_header_line(header_line)
    notes.extend(header["header_notes"])

    reqs, rnotes = parse_requirements(get_field(fields, "Requirements", "Requirement", "Additional Requirements"))
    notes.extend(rnotes)
    derived, anotes = parse_adjustments(
        get_field(fields, "Adjustments", "Adjustment"), reqs
    )
    notes.extend(anotes)

    # Ensure SO_range exists with a default if missing
    if not any(r.get("type") == "SO_range" for r in reqs):
        reqs.append({"type": "SO_range", "min": 1, "max": 12})
        notes.append("SO range missing in source; defaulted to 1-12")

    auto_line = get_field(
        fields,
        "Automatic Advantages and Disadvantages",
        "Automatic Advantages",
        "Automatic Disadvantages",
    )
    # If only advantages or only disadvantages labeled separately, merge
    auto_adv_only = get_field(fields, "Automatic Advantages")
    auto_dis_only = get_field(fields, "Automatic Disadvantages")
    auto_advantages = []
    auto_disadvantages = []
    if auto_line and "Automatic Advantages and Disadvantages" in [
        k for k in fields
    ] or (
        auto_line
        and get_field(fields, "Automatic Advantages and Disadvantages")
    ):
        a, d = split_adv_dis(get_field(fields, "Automatic Advantages and Disadvantages"))
        for t in a:
            tid, note = trait_id_guess(t)
            auto_advantages.append({"id": tid, "note": note} if "(" in note or note != tid else {"id": tid})
            # always keep note if rating-like
            entry = {"id": tid}
            if note and note != tid.replace("_", " "):
                entry["note"] = note
            # rating?
            rm = re.search(r"\b(\d{1,2})\b", t)
            if rm and int(rm.group(1)) <= 20:
                # Heuristic: if looks like rating on a disadvantage-style phrase after /
                pass
            auto_advantages[-1] = entry if auto_advantages else entry
        auto_advantages = []
        for t in a:
            tid, note = trait_id_guess(t)
            entry = {"id": tid}
            if note and len(note) > len(tid):
                entry["note"] = note
            auto_advantages.append(entry)
        for t in d:
            tid, note = trait_id_guess(t)
            entry = {"id": tid}
            rm = re.search(r"(?:^|\s)(\d{1,2})(?:\s|;|,|$|\()", t)
            if rm:
                entry["rating"] = int(rm.group(1))
            if note and ("(" in note or len(note) > len(tid) + 3):
                entry["note"] = note
            auto_disadvantages.append(entry)
    else:
        if auto_adv_only:
            for t in [collapse(x) for x in auto_adv_only.split(",") if collapse(x)]:
                tid, note = trait_id_guess(t)
                entry = {"id": tid}
                if note and len(note) > len(tid):
                    entry["note"] = note
                auto_advantages.append(entry)
        if auto_dis_only:
            for t in [collapse(x) for x in auto_dis_only.split(",") if collapse(x)]:
                tid, note = trait_id_guess(t)
                entry = {"id": tid}
                rm = re.search(r"(?:^|\s)(\d{1,2})(?:\s|;|,|$|\()", t)
                if rm:
                    entry["rating"] = int(rm.group(1))
                if note and len(note) > len(tid) + 3:
                    entry["note"] = note
                auto_disadvantages.append(entry)
        # Combined line under Automatic Advantages and Disadvantages may still exist as auto_line
        if not auto_advantages and not auto_disadvantages and auto_line:
            a, d = split_adv_dis(auto_line)
            for t in a:
                tid, note = trait_id_guess(t)
                entry = {"id": tid}
                if note and len(note) > len(tid):
                    entry["note"] = note
                auto_advantages.append(entry)
            for t in d:
                tid, note = trait_id_guess(t)
                entry = {"id": tid}
                rm = re.search(r"(?:^|\s)(\d{1,2})(?:\s|;|,|$|\()", t)
                if rm:
                    entry["rating"] = int(rm.group(1))
                if note and len(note) > len(tid) + 3:
                    entry["note"] = note
                auto_disadvantages.append(entry)

    rec_line = get_field(
        fields,
        "Recommended Advantages and Disadvantages",
        "Recommended Advantages",
        "Recommended Disadvantages",
        "Recommended and Unsuitable Advantages and Disadvantages",
    )
    uns_line = get_field(
        fields,
        "Unsuitable Advantages and Disadvantages",
        "Unsuitable Advantages",
        "Unsuitable Disadvantages",
    )
    # If combined recommended/unsuitable
    if get_field(fields, "Recommended and Unsuitable Advantages and Disadvantages"):
        notes.append(
            "Recommended/Unsuitable combined line: "
            + get_field(fields, "Recommended and Unsuitable Advantages and Disadvantages")
        )
        rec_a, rec_d = [], []
        uns_a, uns_d = [], []
    else:
        rec_a, rec_d = split_adv_dis(rec_line) if rec_line else ([], [])
        uns_a, uns_d = split_adv_dis(uns_line) if uns_line else ([], [])
        # Unsuitable sometimes only disadvantages labeled
        if uns_line and not uns_a and not uns_d:
            uns_d = [collapse(x) for x in uns_line.split(",") if collapse(x)]

    talent_mods = OrderedDict()
    choice_mods = []
    for label in (
        "Combat Talents",
        "Physical Talents",
        "Social Talents",
        "Nature Talents",
        "Lore Talents",
        "Artisan Talents",
    ):
        parse_talent_line(get_field(fields, label), talent_mods, choice_mods, notes)

    lang = get_field(fields, "Languages and Scripts")
    if lang and lang not in ("-", "—"):
        notes.append("Languages/Scripts (manual): " + lang)
        choice_mods.append({"note": "Languages and Scripts: " + lang})

    auto_sas = parse_sa_line(
        get_field(fields, "Special Abilities", "Special Ability"), True
    )
    disc_sas = parse_sa_line(
        get_field(
            fields, "Discounted Special Abilities", "Discounted Special Ability"
        ),
        False,
    )

    equipment = parse_equipment(get_field(fields, "Equipment"))
    special_possession = get_field(fields, "Special Possession") or None
    if special_possession in ("-", "—", "not provided", "Not provided"):
        special_possession = None

    # Magical / divine status heuristics
    magical_status = "none"
    spell_group_weight = 0.0
    if category == "magical":
        magical_status = "full_caster"
        spell_group_weight = 1.2
    elif category == "divine_animistic":
        magical_status = "consecrated"
        spell_group_weight = 0.4
    if get_field(fields, "Spells", "Starting Spells", "Liturgies"):
        if magical_status == "none":
            magical_status = "full_caster"
            spell_group_weight = 1.0
        notes.append(
            "Spell/liturgy package present — see source; not fully structured in Phase 1"
        )

    name = header["name"] or title.split("(")[0].strip()
    # Elven Professions base is "Keeper"
    if "ELVEN PROFESSIONS" in title.upper() and name.lower() == "keeper":
        pid = "elven_keeper"
        name = "Elven Keeper"
    else:
        pid = slugify(name)

    german = header["german_name"]
    if not german:
        gm = re.search(r"\(([^)]+)\)\s*$", title.strip())
        if gm:
            german = collapse(gm.group(1))

    # Remap legacy ids
    if pid in LEGACY_ID_REMAP:
        pid = LEGACY_ID_REMAP[pid]
    if pid == "magician":
        name = "Guild Magician"
        if not german:
            german = "Magier"

    source = "WdH p. %s" % (header["source_page"] or "?")
    if section_num:
        source = "WdH #%s p. %s" % (section_num, header["source_page"] or "?")

    # Completeness — language notes are expected; only flag serious gaps
    data_complete = True
    if header["gp_cost"] is None:
        data_complete = False
    serious = [
        n
        for n in notes
        if n.startswith("Unresolved")
        or n.startswith("Dropped")
        or "GP cost depends" in n
        or "defaulted to 1-12" in n
        or "structural heading" in n.lower()
    ]
    if serious:
        data_complete = False

    # Provisional GP when WdH base says cost depends on academy/style
    PROVISIONAL_GP = {
        "warrior": 18,
        "magician": 22,
        "sword_companion": 22,
    }
    gp_cost = header["gp_cost"]
    if gp_cost is None and pid in PROVISIONAL_GP:
        gp_cost = PROVISIONAL_GP[pid]
        notes.append(
            "Provisional gp_cost=%d used until academy/style variants are encoded"
            % gp_cost
        )
        data_complete = False

    # Magician base: ASP/RM from prose adjustments
    adj_raw = get_field(fields, "Adjustments", "Adjustment")
    if adj_raw and "ASP" not in derived:
        am = re.search(r"\+(\d+)\s*ASP", adj_raw, re.I)
        if am:
            derived["ASP"] = int(am.group(1))
        rm = re.search(r"\bRM\s*\+?\s*(\d+)", adj_raw, re.I)
        if rm:
            derived["RM"] = int(rm.group(1))

    affinity = list(AFFINITY_FROM_CATEGORY.get(category, []))
    # Refine affinity from talent package
    combat_sum = sum(
        v
        for k, v in talent_mods.items()
        if k
        in {
            "swords",
            "sabers",
            "axes_and_maces",
            "spears",
            "brawling",
            "wrestling",
            "bastard_sword",
            "two_handed_swords",
            "infantry_weapons",
        }
    )
    if combat_sum >= 8 and "combat_frontliner" not in affinity:
        affinity.insert(0, "combat_frontliner")
    if talent_mods.get("sneak", 0) + talent_mods.get("pick_locks", 0) >= 4:
        affinity.append("stealth")
    if talent_mods.get("survival", 0) + talent_mods.get("track", 0) >= 4:
        affinity.append("wilderness")
    if talent_mods.get("treat_wounds", 0) >= 4:
        affinity.append("healer")
    if talent_mods.get("arcane_lore", 0) >= 4:
        affinity.append("scholar")

    return OrderedDict(
        [
            ("id", pid),
            ("name", name),
            ("german_name", german),
            ("category", category),
            ("gp_cost", gp_cost),
            ("time_consuming", header["time_consuming"]),
            ("requirements", reqs),
            ("derived_modifiers", derived),
            ("automatic_advantages", auto_advantages),
            ("automatic_disadvantages", auto_disadvantages),
            (
                "recommended_traits",
                {"advantages": rec_a, "disadvantages": rec_d},
            ),
            (
                "unsuitable_traits",
                {"advantages": uns_a, "disadvantages": uns_d},
            ),
            ("choice_blocks", []),
            ("talent_modifiers", dict(talent_mods)),
            ("talent_choice_modifiers", choice_mods),
            ("automatic_SAs", auto_sas),
            ("discounted_SAs", disc_sas),
            ("starting_equipment", equipment),
            ("special_possession", special_possession),
            ("magical_status", magical_status),
            ("spell_modifiers", {}),
            ("affinity_tags", affinity),
            ("talent_group_weights", {}),
            ("talent_bias", {}),
            ("talent_avoid_bias", {}),
            ("attribute_bias", {}),
            ("advantage_pick_bias", {}),
            ("disadvantage_pick_bias", {}),
            ("at_pa_bias", "balanced"),
            ("spell_group_weight", spell_group_weight),
            ("variants", []),
            ("description", description),
            ("source", source),
            ("data_complete", data_complete),
            ("data_notes", "; ".join(notes) if notes else None),
            ("description_format", "plain_text_paragraphs"),
        ]
    )


def seed_weights(professions, concepts):
    """Copy weight fields from closest concept into each profession."""
    any_c = concepts.get("any", {})
    for p in professions:
        tags = p.get("affinity_tags") or []
        concept_id = None
        for t in tags:
            if t in concepts:
                concept_id = t
                break
        if not concept_id:
            concept_id = CATEGORY_DEFAULT_CONCEPT.get(p.get("category"), "any")
        src = concepts.get(concept_id) or any_c

        def copy_map(key):
            val = src.get(key)
            return dict(val) if isinstance(val, dict) else {}

        p["talent_group_weights"] = copy_map("talent_group_weights") or {
            "combat_talents": 0.2,
            "physical_talents": 0.2,
            "nature_talents": 0.15,
            "social_talents": 0.15,
            "lore_talents": 0.15,
            "artisan_talents": 0.15,
        }
        p["talent_bias"] = copy_map("talent_bias")
        p["talent_avoid_bias"] = copy_map("talent_avoid_bias")
        p["attribute_bias"] = copy_map("attribute_bias") or {
            a: 1 for a in ATTRS
        }
        p["advantage_pick_bias"] = copy_map("advantage_pick_bias")
        p["disadvantage_pick_bias"] = copy_map("disadvantage_pick_bias")
        bias = src.get("at_pa_bias") or "balanced"
        if bias not in ("offensive", "defensive", "balanced"):
            bias = "balanced"
        p["at_pa_bias"] = bias
        if not p.get("spell_group_weight"):
            sg = src.get("spell_group_weight")
            p["spell_group_weight"] = float(sg) if isinstance(sg, (int, float)) else 0.0

        # Refine talent_bias from actual talent_modifiers
        for tid, val in (p.get("talent_modifiers") or {}).items():
            if not isinstance(val, (int, float)) or val <= 0:
                continue
            boost = 1.0 + min(1.5, val / 6.0)
            prev = p["talent_bias"].get(tid, 1.0)
            p["talent_bias"][tid] = round(max(prev, boost), 2)

        # Attribute bias from requirements
        for r in p.get("requirements") or []:
            if r.get("type") == "attr_min" and r.get("attr") in ATTRS:
                a = r["attr"]
                floor = int(r.get("value") or 8)
                bump = max(1, floor - 10)
                p["attribute_bias"][a] = max(int(p["attribute_bias"].get(a, 0)), bump)


def load_legacy_keep(old_path):
    """Keep pirate, legend_singer, ranger from old file as legacy entries."""
    if not old_path.exists():
        return []
    old = json.loads(old_path.read_text(encoding="utf-8"))
    keep_ids = {"pirate", "legend_singer", "ranger"}
    out = []
    for p in old.get("professions", []):
        if p.get("id") not in keep_ids:
            continue
        # Upgrade to new schema fields
        p = dict(p)
        p.setdefault("category", "traveling_wilderness" if p["id"] == "pirate" else "magical")
        p.setdefault("recommended_traits", {"advantages": [], "disadvantages": []})
        p.setdefault("unsuitable_traits", {"advantages": [], "disadvantages": []})
        p.setdefault("variants", [])
        p.setdefault("talent_group_weights", {})
        p.setdefault("talent_bias", {})
        p.setdefault("talent_avoid_bias", {})
        p.setdefault("attribute_bias", {})
        p.setdefault("advantage_pick_bias", {})
        p.setdefault("disadvantage_pick_bias", {})
        p.setdefault("at_pa_bias", "balanced")
        p.setdefault("spell_group_weight", 0.0)
        notes = p.get("data_notes") or ""
        legacy_note = (
            "Legacy BRW entry retained pending WdH variant pass "
            "(pirate→Seafarer variant; legend_singer/ranger→Elven Professions variants)."
        )
        p["data_notes"] = (notes + "; " if notes else "") + legacy_note
        p["data_complete"] = False
        p["source"] = (p.get("source") or "BRW") + " [legacy pending WdH variants]"
        out.append(p)
    return out


def main():
    load_talent_catalog()
    text = SRC.read_text(encoding="utf-8", errors="replace")

    # Split into numbered sections
    sec_re = re.compile(r"^(\d+)\. (.+)$", re.M)
    matches = list(sec_re.finditer(text))
    professions = []
    seen_ids = set()

    for i, m in enumerate(matches):
        num = m.group(1)
        title = m.group(2).strip()
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end]
        category = section_category(chunk)
        description = section_description(chunk)

        base_m = re.search(
            r"\[BASE PROFILE OF [^\]]+\]\n(.*?)(?=\n\[VARIANT|\nEND OF ENTRY|\nSOURCE STRUCTURE|\Z)",
            chunk,
            re.S,
        )
        if base_m:
            prof = build_profession(num, title, category, description, base_m.group(1), stub=False)
        else:
            # Structural heading without base stats
            prof = build_profession(num, title, category, description, chunk, stub=True)

        # Deduplicate ids
        pid = prof["id"]
        if pid in seen_ids:
            pid2 = pid + "_" + num
            prof["id"] = pid2
            pid = pid2
        seen_ids.add(pid)
        professions.append(prof)

    # Attach legacy keepers (only if not already present)
    for legacy in load_legacy_keep(OLD_PROFESSIONS):
        if legacy["id"] not in seen_ids:
            professions.append(legacy)
            seen_ids.add(legacy["id"])

    # Seed weights from concepts
    concepts = {}
    if CONCEPT_WEIGHTS.exists():
        concepts = json.loads(CONCEPT_WEIGHTS.read_text(encoding="utf-8")).get(
            "concepts", {}
        )
    seed_weights(professions, concepts)

    # Clean null data_notes
    for p in professions:
        if not p.get("data_notes"):
            p.pop("data_notes", None)

    out = OrderedDict(
        [
            (
                "meta",
                OrderedDict(
                    [
                        ("schema_version", "2.0"),
                        ("last_updated", "2026-08-04"),
                        (
                            "description",
                            "Professions from Wege der Helden (Phase 1: parent/base profiles). "
                            "Generation weight fields formerly on concepts now live per profession. "
                            "variants[] reserved for academy/unit/order overlays. "
                            "Legacy ids messenger/mountebank/physician/magician preserved; "
                            "pirate/legend_singer/ranger kept as incomplete legacy entries.",
                        ),
                        (
                            "source_books",
                            [
                                "Wege der Helden (2011) pp. 96–243",
                                "Wege_der_Helden_Professions_English_Complete(3).txt",
                            ],
                        ),
                    ]
                ),
            ),
            ("professions", professions),
        ]
    )

    OUT.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    complete = sum(1 for p in professions if p.get("data_complete"))
    print(
        "Wrote %d professions (%d data_complete) -> %s"
        % (len(professions), complete, OUT)
    )


if __name__ == "__main__":
    main()

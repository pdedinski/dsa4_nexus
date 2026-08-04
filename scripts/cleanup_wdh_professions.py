#!/usr/bin/env python3
"""Post-parse cleanup: fix bad ids, translate residual German fragments."""
from __future__ import print_function

import json
import re
from collections import OrderedDict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PROF = REPO / "data" / "core" / "professions.json"
CULT = REPO / "data" / "core" / "cultures.json"

ID_FIX = {
    "prospektor": "prospector",
    "possessed_profession_overlay_for_tribal_warrior_herdsman_hunter_or_highwayman_of_ferkina_culture_3_gp_time_consuming": "ferkina_possessed",
    "preacher_of_the_league_of_the_true_faith_preacher_from_the_bund_of_the_true_faith": "league_true_faith_preacher",
    "late_consecration_to_kor_a_hero_who_already_fulfills_all_requirements_at_the_beginning_of_play_may_receive_consecration_into_the_church_of_kor_through_broad_education_this_costs_11_gp_in_addition_to_the_gp_cost_of_broad_education_and_the_original_profession": "kor_late_consecration",
    "infantry_cadet_officer": "cadet_officer",
    "blessed_one_of_the_swafnir": "blessed_one_of_swafnir",
    "tribal_warrior_the_beni_dervez": "tribal_warrior_beni_dervez",
    "priest_the_h_szint": "priest_of_hszint",
    "shaman_the_achaz": "achaz_shaman",
    "zibilja_72": "zibilja",
    "blessed_one_the_rondra": "blessed_one_of_rondra",
    "blessed_one_the_travia": "blessed_one_of_travia",
    "blessed_one_of_boronr": "blessed_one_of_boron",
    "blessed_one_the_hesinde": "blessed_one_of_hesinde",
    "blessed_one_the_tsa": "blessed_one_of_tsa",
    "blessed_one_the_peraine": "blessed_one_of_peraine",
    "blessed_one_the_rahja": "blessed_one_of_rahja",
    "blessed_one_of_the_nandus": "blessed_one_of_nandus",
    "blessed_one_the_ifirn": "blessed_one_of_ifirn",
    "dervish_caller_of_rastullah_s_power": "dervish",
    "durro_d_n_gjalskerlander_tierkrieger": "durro_dun",
}

# Aliases matching lib/talents/modifierNormalization.ts SIMPLE_ALIASES (+ extras)
TALENT_ALIAS = {
    "bow": "bows",
    "crossbow": "crossbows",
    "climbing": "climb",
    "boating": "boats",
    "swimming": "swim",
    "tracking": "track",
    "trapping": "trap",
    "fishing": "fish",
    "leatherwork": "leathercraft",
    "woodworking": "woodcraft",
    "willpower": "self_control",
    "legends_tales": "legend_lore",
    "religion_cult": "religious_lore",
    "magic_lore": "arcane_lore",
    "military_art": "warcraft",
    "weather_forecasting": "weather_sense",
    "wilderness_living": "survival",
    "binding_escape": "bind_escape",
    "mechanics": "light_engineering",
    "fine_mechanics": "light_engineering",
    "heal_wounds": "treat_wounds",
    "foreign_language": "language_lore",
    "foreign_language_1": "language_lore",
    "foreign_language_2": "language_lore",
    "own_script": "read_write_kuslik",
    "arcane_script": "read_write_sacred_glyphs",
    "music": "play_instrument",
    # Not in catalog — drop to notes rather than inventing talents:
    # statecraft, written_expression, philosophy, pottery, treat_soul, flint_working, skiing
}

NAME_FIX = {
    "ferkina_possessed": "Ferkina Possessed",
    "league_true_faith_preacher": "Preacher of the League of the True Faith",
    "kor_late_consecration": "Late Consecration to Kor",
    "cadet_officer": "Cadet Officer",
    "prospector": "Prospector",
    "blessed_one_of_swafnir": "Blessed One of Swafnir",
    "tribal_warrior_beni_dervez": "Tribal Warrior of the Beni Dervez",
    "priest_of_hszint": "Priest of H'Szint",
    "achaz_shaman": "Achaz Shaman",
    "dervish": "Dervish",
    "durro_dun": "Durro-Dûn",
    "blessed_one_of_rondra": "Blessed One of Rondra",
    "blessed_one_of_travia": "Blessed One of Travia",
    "blessed_one_of_boron": "Blessed One of Boron",
    "blessed_one_of_hesinde": "Blessed One of Hesinde",
    "blessed_one_of_tsa": "Blessed One of Tsa",
    "blessed_one_of_peraine": "Blessed One of Peraine",
    "blessed_one_of_rahja": "Blessed One of Rahja",
    "blessed_one_of_nandus": "Blessed One of Nandus",
    "blessed_one_of_ifirn": "Blessed One of Ifirn",
}

REPL = [
    (re.compile(r"Füchsisch"), "Thieves' Cant"),
    (re.compile(r"Mittelländer"), "Middenrealmers"),
    (re.compile(r"Tulamiden"), "Tulamides"),
    (re.compile(r"\bGehör\b"), "Hearing"),
    (re.compile(r"\bSicht\b"), "Sight"),
    (re.compile(r"hauptsächliches"), "primary"),
    (re.compile(r"Jagdrevier"), "hunting grounds"),
    (re.compile(r"woodfälleraxt", re.I), "woodcutting axe"),
    (re.compile(r"Jonglierkeulen or -bälle"), "juggling clubs or balls"),
    (re.compile(r"Ortseinschätzung"), "Local Knowledge"),
    (re.compile(r"Umgebung the Schänke"), "area around the inn"),
    (re.compile(r"Pilzzüchter"), "Mushroom Grower"),
    (re.compile(r"Geschmack"), "Taste"),
    (re.compile(r"Glasbläsern"), "glassblowers"),
    (re.compile(r"Bäckern"), "bakers"),
    (re.compile(r"zu ersetzen"), "to replace"),
    (re.compile(r"barfüßig or erdgebunden"), "barefoot or earthbound"),
    (re.compile(r"Feudalherrschaft or Götterglaube"), "feudal rule or belief in the gods"),
    (re.compile(r"Zeitgefühl"), "sense of time"),
    (re.compile(r"Traumgänger"), "Dreamwalker"),
    (re.compile(r"Alpträume"), "nightmares"),
    (re.compile(r"thorwalsche Autoritäten"), "Thorwalian authorities"),
    (re.compile(r"falls ausgestoßen or ['']desertiert['']"), "if expelled or deserted"),
    (re.compile(r"außer for Reiterei"), "except for cavalry"),
    (re.compile(r"üblichen Fischgrund"), "usual fishing grounds"),
    (re.compile(r"Südmeer"), "Southern Sea"),
    (re.compile(r"waidmännische Jagd"), "sportsmanlike hunting"),
    (re.compile(r"Geld and Währung"), "money and currency"),
    (re.compile(r"Aufmerksamer Wächter"), "Watchful Guardian"),
    (re.compile(r"Schützende Rotte"), "Protective Pack"),
    (re.compile(r"Kristallkraft bündeln"), "Focus Crystal Power"),
    (re.compile(r"Siedlerstädte of the North"), "settler towns of the North"),
    (re.compile(r"Akklimatisierung \(Hitze\)"), "Acclimatization (Heat)"),
    (re.compile(r"Zorn of the Schneelaurers"), "Wrath of the Snow Lurker"),
    (re.compile(r"Zorn of the Berglöwen"), "Wrath of the Mountain Lion"),
]


def fix_str(s):
    if not isinstance(s, str):
        return s
    for rx, rep in REPL:
        s = rx.sub(rep, s)
    return s


def walk(obj):
    if isinstance(obj, str):
        return fix_str(obj)
    if isinstance(obj, list):
        return [walk(x) for x in obj]
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    return obj


def load_talent_ids():
    ids = set()
    for path in (REPO / "data" / "talents").glob("*.json"):
        raw = json.loads(path.read_text(encoding="utf-8"))
        for key, val in raw.items():
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, dict) and "id" in item:
                        ids.add(item["id"])
    return ids


def normalize_talent_maps(prof, valid):
    notes = []
    for key in ("talent_modifiers", "talent_bias", "talent_avoid_bias"):
        src = prof.get(key)
        if not isinstance(src, dict):
            continue
        out = {}
        for tid, val in src.items():
            mapped = TALENT_ALIAS.get(tid, tid)
            if mapped not in valid:
                notes.append("%s:%s" % (key, tid))
                continue
            if mapped in out and isinstance(val, (int, float)) and isinstance(out[mapped], (int, float)):
                # keep max for modifiers/bias
                out[mapped] = max(out[mapped], val) if key != "talent_avoid_bias" else min(out[mapped], val)
            else:
                out[mapped] = val
        prof[key] = out
    # choice modifier from lists
    choices = prof.get("talent_choice_modifiers") or []
    new_choices = []
    for ch in choices:
        if not isinstance(ch, dict):
            new_choices.append(ch)
            continue
        fr = ch.get("from")
        if isinstance(fr, list):
            mapped = []
            for tid in fr:
                m = TALENT_ALIAS.get(tid, tid)
                if m in valid:
                    mapped.append(m)
                else:
                    notes.append("choice:%s" % tid)
            ch = dict(ch)
            ch["from"] = mapped
            if mapped:
                new_choices.append(ch)
            elif ch.get("note"):
                new_choices.append({"note": ch["note"]})
        else:
            new_choices.append(ch)
    prof["talent_choice_modifiers"] = new_choices
    if notes:
        msg = "Dropped unknown talent ids (not in catalog yet): " + ", ".join(sorted(set(notes)))
        prev = prof.get("data_notes") or ""
        if msg not in prev:
            prof["data_notes"] = (prev + "; " if prev else "") + msg
        prof["data_complete"] = False


def main():
    valid = load_talent_ids()
    data = json.loads(PROF.read_text(encoding="utf-8"))
    seen = set()
    out = []
    for p in data["professions"]:
        pid = p["id"]
        if pid in ID_FIX:
            p["id"] = ID_FIX[pid]
            pid = p["id"]
        if pid in NAME_FIX:
            p["name"] = NAME_FIX[pid]
        if pid in seen:
            continue
        seen.add(pid)
        p = walk(p)
        normalize_talent_maps(p, valid)
        out.append(p)
    data["professions"] = out
    PROF.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    cultures = json.loads(CULT.read_text(encoding="utf-8"))
    all_ids = [p["id"] for p in out]
    for c in cultures["cultures"]:
        c["allowed_professions"] = list(OrderedDict((x, None) for x in all_ids).keys())
    CULT.write_text(
        json.dumps(cultures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("professions", len(out), "cultures refreshed")


if __name__ == "__main__":
    main()

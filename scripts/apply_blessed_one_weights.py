#!/usr/bin/env python3
"""
Apply WdG-based Blessed One generation weights and fix mislabeled cult ids.

Renames:
  lay_preacher        -> blessed_one_of_aves
  traditional_cult    -> blessed_one_of_ingerimm
  keeper_of_the_forge -> blessed_one_of_angrosch

Also updates cultures.json allowed_professions references.
"""
from __future__ import print_function

import json
from collections import OrderedDict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PROF_PATH = REPO / "data" / "core" / "professions.json"
CULT_PATH = REPO / "data" / "core" / "cultures.json"

ID_RENAME = {
    "lay_preacher": "blessed_one_of_aves",
    "traditional_cult": "blessed_one_of_ingerimm",
    "keeper_of_the_forge": "blessed_one_of_angrosch",
}

NAME_FIX = {
    "blessed_one_of_aves": ("Blessed One of Aves", "Aves-Geweihte"),
    "blessed_one_of_ingerimm": ("Blessed One of Ingerimm", "Ingerimm-Geweihte"),
    "blessed_one_of_angrosch": ("Blessed One of Angrosch", "Angrosch-Geweihte"),
}

# Shared cult defaults
RELIGIOUS = 2.0
SOCIAL_BASE = {"teach": 1.55, "human_nature": 1.55, "persuade": 1.55}


def groups(**kw):
    base = {
        "combat_talents": 0.08,
        "physical_talents": 0.14,
        "nature_talents": 0.12,
        "social_talents": 0.18,
        "lore_talents": 0.28,
        "artisan_talents": 0.20,
    }
    base.update(kw)
    total = sum(base.values())
    return {k: round(v / total, 4) for k, v in base.items()}


def attrs(**kw):
    base = {"CO": 0, "CL": 0, "IN": 0, "CH": 0, "DE": 0, "AG": 0, "CN": 0, "ST": 0}
    base.update(kw)
    return base


def bias_map(*pairs):
    out = {}
    for tid, w in pairs:
        out[tid] = w
    return out


def avoid_map(*pairs):
    return bias_map(*pairs)


def merge_package_bias(prof, talent_bias):
    """Slightly raise talents that already get package modifiers."""
    mods = prof.get("talent_modifiers") or {}
    out = dict(talent_bias)
    for tid, mod in mods.items():
        if not isinstance(mod, (int, float)) or mod <= 0:
            continue
        bump = 1.0 + min(float(mod), 7.0) * 0.12
        out[tid] = round(max(out.get(tid, 1.0), bump), 2)
    # Always keep religious lore strong for consecrated cults
    out["religious_lore"] = round(max(out.get("religious_lore", 1.0), RELIGIOUS), 2)
    return out


def profile(
    affinity,
    group,
    talent_bias,
    talent_avoid,
    attribute_bias,
    advantage_pick_bias,
    disadvantage_pick_bias,
    at_pa_bias="defensive",
    spell_group_weight=0.35,
    note=None,
):
    return {
        "affinity_tags": affinity,
        "talent_group_weights": group,
        "talent_bias": talent_bias,
        "talent_avoid_bias": talent_avoid,
        "attribute_bias": attribute_bias,
        "advantage_pick_bias": advantage_pick_bias,
        "disadvantage_pick_bias": disadvantage_pick_bias,
        "at_pa_bias": at_pa_bias,
        "spell_group_weight": spell_group_weight,
        "note": note,
    }


# Per-cult weight profiles (keyed by final profession id)
PROFILES = {
    "blessed_one_of_praios": profile(
        affinity=["scholar", "social", "divine"],
        group=groups(
            lore_talents=0.35,
            social_talents=0.28,
            physical_talents=0.12,
            artisan_talents=0.12,
            combat_talents=0.08,
            nature_talents=0.05,
        ),
        talent_bias=bias_map(
            ("religious_lore", 2.15),
            ("law", 2.10),
            ("persuade", 1.90),
            ("self_control", 1.95),
            ("etiquette", 1.90),
            ("human_nature", 1.85),
            ("teach", 1.75),
            ("history", 1.65),
            ("calculate", 1.70),
            ("heraldry", 1.60),
            ("legend_lore", 1.55),
            ("geography", 1.50),
            ("starcraft", 1.55),
            ("arcane_lore", 1.45),
            ("board_games", 1.40),
            ("ride", 1.45),
            ("axes_and_maces", 1.50),
            ("animal_training", 1.35),
        ),
        talent_avoid=avoid_map(
            ("sneak", 0.25),
            ("hide", 0.25),
            ("masquerade", 0.2),
            ("cheat", 0.2),
            ("pick_pockets", 0.2),
            ("fast_talk", 0.3),
            ("seduce", 0.25),
            ("streetwise", 0.35),
        ),
        attribute_bias=attrs(CO=3, CH=3, CL=2, IN=1, CN=1, DE=0, AG=0, ST=0),
        advantage_pick_bias={
            "high_rm": 1.7,
            "good_memory_i": 1.6,
            "connections": 1.45,
            "hard_to_enspell": 1.5,
            "prophecy": 1.4,
            "euphonic_voice": 1.35,
            "time_sense": 1.35,
            "noble_birth": 1.4,
            "aptitude_talent_group_other": 1.45,
            "outstanding_attribute": 1.4,
        },
        disadvantage_pick_bias={
            "arrogance": 1.65,
            "vanity": 1.45,
            "greed": 1.4,
            "violent_temper": 1.35,
            "prejudice": 1.5,
            "superstition": 0.15,
            "wanted_i": 0.15,
            "light_sensitive": 0.1,
            "light_shy": 0.1,
            "low_rm": 0.15,
            "restless": 0.2,
        },
        at_pa_bias="defensive",
    ),
    "blessed_one_of_rondra": profile(
        affinity=["combat_frontliner", "divine"],
        group=groups(
            combat_talents=0.40,
            physical_talents=0.22,
            lore_talents=0.12,
            social_talents=0.12,
            nature_talents=0.07,
            artisan_talents=0.07,
        ),
        talent_bias=bias_map(
            ("swords", 2.15),
            ("sabers", 2.0),
            ("infantry_weapons", 1.95),
            ("axes_and_maces", 1.85),
            ("spears", 1.85),
            ("two_handed_swords", 1.8),
            ("athletics", 1.85),
            ("body_control", 1.85),
            ("ride", 1.7),
            ("self_control", 1.85),
            ("warcraft", 1.9),
            ("treat_wounds", 1.55),
            ("heraldry", 1.5),
            ("perception", 1.45),
            ("persuade", 1.45),
            ("law", 1.4),
            ("religious_lore", 1.9),
        ),
        talent_avoid=avoid_map(
            ("bows", 0.35),
            ("crossbows", 0.35),
            ("sneak", 0.25),
            ("hide", 0.25),
            ("masquerade", 0.2),
            ("cheat", 0.2),
            ("pick_pockets", 0.2),
            ("seduce", 0.35),
        ),
        attribute_bias=attrs(CO=3, AG=2, CN=2, ST=2, CL=1, CH=1, IN=1, DE=0),
        advantage_pick_bias={
            "iron": 1.7,
            "enduring": 1.55,
            "tough_dog": 1.5,
            "vigor": 1.45,
            "fast_healing": 1.35,
            "aptitude_melee_talents": 1.55,
            "outstanding_attribute": 1.35,
            "connections": 1.25,
        },
        disadvantage_pick_bias={
            "violent_temper": 1.55,
            "vengefulness": 1.45,
            "prejudice": 1.35,
            "arrogance": 1.25,
            "one_handed": 0.1,
            "one_armed": 0.1,
            "lame": 0.15,
            "glass_bones": 0.15,
            "low_vitality": 0.2,
            "inaptitude_melee": 0.1,
            "blood_frenzy": 0.25,
        },
        at_pa_bias="offensive",
    ),
    "blessed_one_of_the_efferd": profile(
        affinity=["sailor", "wilderness", "divine"],
        group=groups(
            nature_talents=0.28,
            physical_talents=0.25,
            artisan_talents=0.18,
            social_talents=0.12,
            lore_talents=0.10,
            combat_talents=0.07,
        ),
        talent_bias=bias_map(
            ("swim", 2.2),
            ("perception", 1.75),
            ("persuade", 1.55),
            ("bind_escape", 1.7),
            ("fish", 1.85),
            ("orientation", 1.8),
            ("weather_sense", 1.9),
            ("boats", 2.0),
            ("seafaring", 2.15),
            ("carpenter", 1.65),
            ("self_control", 1.45),
            ("religious_lore", 1.85),
        ),
        talent_avoid=avoid_map(
            ("alchemy", 0.25),
            ("cook", 0.3),
            ("blacksmith", 0.25),
            ("stonemason", 0.35),
        ),
        attribute_bias=attrs(IN=2, CN=2, AG=2, CL=1, CH=1, CO=1, DE=1, ST=1),
        advantage_pick_bias={
            "direction_sense": 1.7,
            "cold_resistance": 1.55,
            "danger_instinct": 1.55,
            "enduring": 1.35,
        },
        disadvantage_pick_bias={
            "violent_temper": 1.35,
            "fear_of": 1.25,
            "fear_of_sea": 0.12,
        },
    ),
    "blessed_one_of_swafnir": profile(
        affinity=["combat_frontliner", "sailor", "divine"],
        group=groups(
            combat_talents=0.28,
            physical_talents=0.25,
            nature_talents=0.18,
            social_talents=0.12,
            artisan_talents=0.10,
            lore_talents=0.07,
        ),
        talent_bias=bias_map(
            ("wrestling", 1.85),
            ("brawling", 1.75),
            ("axes_and_maces", 1.9),
            ("body_control", 1.85),
            ("swim", 2.1),
            ("self_control", 1.8),
            ("carouse", 1.7),
            ("teach", 1.55),
            ("orientation", 1.75),
            ("weather_sense", 1.8),
            ("seafaring", 2.05),
            ("boats", 1.7),
            ("fish", 1.55),
            ("athletics", 1.55),
            ("legend_lore", 1.4),
            ("animal_lore", 1.35),
            ("carpenter", 1.4),
            ("religious_lore", 1.75),
        ),
        talent_avoid=avoid_map(
            ("etiquette", 0.4),
            ("seduce", 0.3),
            ("fast_talk", 0.45),
            ("cheat", 0.25),
            ("arcane_lore", 0.45),
            ("starcraft", 0.5),
        ),
        attribute_bias=attrs(CO=3, ST=2, CN=2, AG=2, CH=2, CL=1, IN=1, DE=1),
        advantage_pick_bias={
            "iron": 1.6,
            "enduring": 1.5,
            "tough_dog": 1.45,
            "direction_sense": 1.55,
            "cold_resistance": 1.5,
            "vigor": 1.4,
        },
        disadvantage_pick_bias={
            "violent_temper": 1.5,
            "prejudice": 1.35,
            "fear_of_sea": 0.08,
            "one_handed": 0.1,
            "lame": 0.15,
            "glass_bones": 0.15,
            "low_vitality": 0.2,
        },
        at_pa_bias="offensive",
    ),
    "blessed_one_of_travia": profile(
        affinity=["healer", "social", "divine"],
        group=groups(
            social_talents=0.30,
            artisan_talents=0.22,
            lore_talents=0.18,
            physical_talents=0.15,
            nature_talents=0.10,
            combat_talents=0.05,
        ),
        talent_bias=bias_map(
            ("self_control", 1.75),
            ("perception", 1.55),
            ("carouse", 1.65),
            ("teach", 1.75),
            ("human_nature", 1.85),
            ("persuade", 1.75),
            ("legend_lore", 1.65),
            ("cook", 1.9),
            ("treat_disease", 1.85),
            ("treat_wounds", 1.55),
            ("animal_training", 1.45),
            ("religious_lore", 1.9),
        ),
        talent_avoid=avoid_map(
            ("bows", 0.3),
            ("crossbows", 0.3),
            ("pick_pockets", 0.2),
            ("seduce", 0.25),
            ("cheat", 0.2),
            ("warcraft", 0.35),
        ),
        attribute_bias=attrs(CH=3, IN=2, CN=2, CL=1, CO=1, DE=1, AG=0, ST=0),
        advantage_pick_bias={
            "good_memory_i": 1.45,
            "social_chameleon": 1.4,
            "educated": 1.3,
            "connections": 1.35,
            "disease_resistance": 1.35,
        },
        disadvantage_pick_bias={
            "prejudice": 1.35,
            "unworldly": 1.3,
            "greed": 0.45,
            "violent_temper": 0.45,
            "blood_frenzy": 0.2,
        },
    ),
    "blessed_one_of_boron": profile(
        affinity=["scholar", "healer", "divine"],
        group=groups(
            lore_talents=0.30,
            social_talents=0.22,
            artisan_talents=0.15,
            physical_talents=0.15,
            nature_talents=0.10,
            combat_talents=0.08,
        ),
        talent_bias=bias_map(
            ("sneak", 1.65),
            ("self_control", 1.9),
            ("teach", 1.65),
            ("human_nature", 1.8),
            ("persuade", 1.65),
            ("history", 1.85),
            ("religious_lore", 2.15),
            ("plant_lore", 1.6),
            ("alchemy", 1.7),
            ("treat_disease", 1.7),
            ("hide", 1.4),
        ),
        talent_avoid=avoid_map(
            ("sing", 0.2),
            ("dance", 0.2),
            ("carouse", 0.2),
            ("seduce", 0.2),
            ("play_instrument", 0.25),
            ("cheat", 0.25),
            ("juggling", 0.25),
            ("masquerade", 0.35),
        ),
        attribute_bias=attrs(CL=3, IN=2, CH=2, CO=2, CN=1, DE=1, AG=0, ST=0),
        advantage_pick_bias={
            "high_rm": 1.65,
            "good_memory_i": 1.55,
            "iron": 1.35,
            "educated": 1.4,
            "hard_to_enspell": 1.35,
        },
        disadvantage_pick_bias={
            "fear_of_dead": 0.35,
            "curiosity": 1.15,
            "unworldly": 1.25,
            "violent_temper": 0.4,
        },
    ),
    "blessed_one_of_hesinde": profile(
        affinity=["scholar", "divine"],
        group=groups(
            lore_talents=0.40,
            social_talents=0.22,
            artisan_talents=0.15,
            physical_talents=0.10,
            nature_talents=0.08,
            combat_talents=0.05,
        ),
        talent_bias=bias_map(
            ("etiquette", 1.65),
            ("teach", 1.85),
            ("human_nature", 1.7),
            ("persuade", 1.65),
            ("history", 1.9),
            ("religious_lore", 2.1),
            ("arcane_lore", 2.15),
            ("plant_lore", 1.7),
            ("starcraft", 1.75),
            ("animal_lore", 1.6),
            ("alchemy", 1.9),
            ("calculate", 1.55),
            ("geography", 1.45),
            ("language_lore", 1.5),
        ),
        talent_avoid=avoid_map(
            ("carouse", 0.3),
            ("cheat", 0.25),
            ("pick_pockets", 0.3),
        ),
        attribute_bias=attrs(CL=3, IN=3, CH=2, DE=1, CO=0, AG=0, CN=1, ST=0),
        advantage_pick_bias={
            "good_memory_i": 1.75,
            "educated": 1.6,
            "high_rm": 1.55,
            "aptitude_talent_group_other": 1.45,
            "outstanding_attribute": 1.4,
        },
        disadvantage_pick_bias={
            "curiosity": 1.6,
            "arrogance": 1.45,
            "prejudice": 1.25,
            "unworldly": 1.2,
        },
        spell_group_weight=0.45,
    ),
    "blessed_one_of_the_firun": profile(
        affinity=["wilderness", "hunter", "divine"],
        group=groups(
            nature_talents=0.32,
            physical_talents=0.28,
            combat_talents=0.18,
            lore_talents=0.10,
            artisan_talents=0.07,
            social_talents=0.05,
        ),
        talent_bias=bias_map(
            ("bows", 2.05),
            ("crossbows", 1.7),
            ("body_control", 1.85),
            ("sneak", 1.9),
            ("hide", 1.85),
            ("self_control", 1.95),
            ("perception", 1.9),
            ("track", 2.1),
            ("orientation", 1.9),
            ("weather_sense", 1.85),
            ("survival", 2.15),
            ("fish", 1.45),
            ("plant_lore", 1.45),
            ("animal_lore", 1.55),
            ("animal_training", 1.4),
            ("religious_lore", 1.75),
        ),
        talent_avoid=avoid_map(
            ("etiquette", 0.3),
            ("seduce", 0.25),
            ("carouse", 0.35),
            ("streetwise", 0.4),
            ("fast_talk", 0.4),
        ),
        attribute_bias=attrs(CO=3, IN=2, CN=2, AG=2, CL=1, CH=0, DE=1, ST=1),
        advantage_pick_bias={
            "danger_instinct": 1.75,
            "direction_sense": 1.65,
            "cold_resistance": 1.65,
            "iron": 1.45,
            "enduring": 1.4,
            "aptitude_ranged_talents": 1.5,
        },
        disadvantage_pick_bias={
            "unworldly": 1.45,
            "prejudice": 1.35,
            "agoraphobia": 0.12,
            "claustrophobia": 0.8,
        },
        at_pa_bias="offensive",
    ),
    "blessed_one_of_tsa": profile(
        affinity=["social", "artisan", "divine"],
        group=groups(
            social_talents=0.25,
            artisan_talents=0.28,
            physical_talents=0.18,
            lore_talents=0.15,
            nature_talents=0.10,
            combat_talents=0.04,
        ),
        talent_bias=bias_map(
            ("masquerade", 1.85),
            ("sing", 1.75),
            ("dance", 1.8),
            ("human_nature", 1.8),
            ("fast_talk", 1.65),
            ("persuade", 1.7),
            ("legend_lore", 1.65),
            ("paint_draw", 1.7),
            ("teach", 1.5),
            ("woodcraft", 1.45),
            ("blacksmith", 1.35),
            ("tailor", 1.4),
            ("plant_lore", 1.4),
            ("animal_training", 1.35),
            ("religious_lore", 1.8),
        ),
        talent_avoid=avoid_map(
            ("swords", 0.3),
            ("infantry_weapons", 0.3),
            ("axes_and_maces", 0.3),
            ("warcraft", 0.25),
            ("two_handed_swords", 0.25),
        ),
        attribute_bias=attrs(CH=3, AG=2, DE=2, IN=2, CL=1, CO=1, CN=1, ST=0),
        advantage_pick_bias={
            "luck": 1.55,
            "good_looking": 1.55,
            "euphonic_voice": 1.45,
            "social_chameleon": 1.5,
            "aptitude_talent_group_other": 1.35,
        },
        disadvantage_pick_bias={
            "curiosity": 1.55,
            "unworldly": 1.35,
            "violent_temper": 0.35,
            "blood_frenzy": 0.2,
        },
    ),
    "blessed_one_of_the_phex": profile(
        affinity=["stealth", "social", "divine"],
        group=groups(
            social_talents=0.25,
            physical_talents=0.22,
            artisan_talents=0.18,
            lore_talents=0.15,
            combat_talents=0.10,
            nature_talents=0.10,
        ),
        talent_bias=bias_map(
            ("body_control", 1.85),
            ("sneak", 2.0),
            ("hide", 1.9),
            ("streetwise", 1.95),
            ("human_nature", 1.75),
            ("fast_talk", 1.9),
            ("light_engineering", 1.7),
            ("law", 1.55),
            ("starcraft", 1.7),
            ("pick_locks", 1.75),
            ("pick_pockets", 1.65),
            ("cheat", 1.6),
            ("climb", 1.55),
            ("masquerade", 1.5),
            ("seduce", 1.4),
            ("juggling", 1.35),
            ("daggers", 1.45),
            ("throwing_knives", 1.4),
            ("religious_lore", 1.75),
        ),
        talent_avoid={},
        attribute_bias=attrs(DE=3, IN=2, AG=2, CH=2, CL=1, CO=1, CN=0, ST=0),
        advantage_pick_bias={
            "luck": 1.7,
            "social_chameleon": 1.6,
            "good_memory_i": 1.45,
            "danger_instinct": 1.5,
            "lucky_gambler": 1.35,
        },
        disadvantage_pick_bias={
            "greed": 1.65,
            "curiosity": 1.5,
            "vanity": 1.4,
            "wanted_i": 1.35,
            "miserliness": 1.25,
        },
        at_pa_bias="defensive",
    ),
    "blessed_one_of_peraine": profile(
        affinity=["healer", "artisan", "divine"],
        group=groups(
            artisan_talents=0.25,
            nature_talents=0.22,
            social_talents=0.20,
            lore_talents=0.15,
            physical_talents=0.13,
            combat_talents=0.05,
        ),
        talent_bias=bias_map(
            ("teach", 1.65),
            ("human_nature", 1.7),
            ("persuade", 1.6),
            ("plant_lore", 2.0),
            ("animal_lore", 1.85),
            ("farming", 1.95),
            ("treat_disease", 2.1),
            ("treat_wounds", 2.05),
            ("treat_poison", 1.7),
            ("cook", 1.8),
            ("animal_training", 1.55),
            ("religious_lore", 1.9),
        ),
        talent_avoid=avoid_map(
            ("swords", 0.25),
            ("infantry_weapons", 0.25),
            ("axes_and_maces", 0.3),
            ("seduce", 0.3),
            ("trap", 0.25),
            ("warcraft", 0.25),
            ("cheat", 0.25),
            ("pick_locks", 0.25),
        ),
        attribute_bias=attrs(CN=2, DE=3, IN=2, CH=2, CL=1, CO=0, AG=0, ST=0),
        advantage_pick_bias={
            "disease_resistance": 1.7,
            "general_poison_resistance": 1.4,
            "fast_healing": 1.45,
            "tough_dog": 1.4,
            "connections": 1.3,
        },
        disadvantage_pick_bias={
            "unworldly": 1.35,
            "prejudice": 1.3,
            "prone_to_illness": 0.35,
            "greed": 0.4,
            "blood_frenzy": 0.2,
            "violent_temper": 0.4,
        },
    ),
    "blessed_one_of_rahja": profile(
        affinity=["social", "entertainer", "divine"],
        group=groups(
            social_talents=0.32,
            physical_talents=0.25,
            artisan_talents=0.18,
            lore_talents=0.12,
            nature_talents=0.08,
            combat_talents=0.05,
        ),
        talent_bias=bias_map(
            ("body_control", 1.8),
            ("ride", 1.75),
            ("perception", 1.55),
            ("carouse", 1.9),
            ("seduce", 2.1),
            ("teach", 1.55),
            ("human_nature", 1.85),
            ("fast_talk", 1.7),
            ("persuade", 1.75),
            ("dance", 1.9),
            ("sing", 1.75),
            ("play_instrument", 1.7),
            ("etiquette", 1.45),
            ("juggling", 1.4),
            ("acrobatics", 1.4),
            ("tattoo", 1.35),
            ("religious_lore", 1.75),
        ),
        talent_avoid=avoid_map(
            ("swords", 0.3),
            ("infantry_weapons", 0.3),
            ("axes_and_maces", 0.3),
            ("warcraft", 0.25),
            ("mining", 0.35),
            ("butcher", 0.35),
        ),
        attribute_bias=attrs(CH=3, AG=2, IN=2, DE=1, CO=1, CL=1, CN=1, ST=0),
        advantage_pick_bias={
            "good_looking": 1.75,
            "euphonic_voice": 1.55,
            "social_chameleon": 1.55,
            "outstanding_appearance": 1.4,
            "connections": 1.3,
        },
        disadvantage_pick_bias={
            "vanity": 1.55,
            "curiosity": 1.45,
            "arrogance": 1.2,
            "violent_temper": 0.4,
        },
    ),
    "blessed_one_of_nandus": profile(
        affinity=["scholar", "social", "divine"],
        group=groups(
            lore_talents=0.35,
            social_talents=0.28,
            artisan_talents=0.12,
            physical_talents=0.10,
            nature_talents=0.08,
            combat_talents=0.07,
        ),
        talent_bias=bias_map(
            ("teach", 2.0),
            ("human_nature", 1.8),
            ("fast_talk", 1.75),
            ("persuade", 1.75),
            ("calculate", 1.9),
            ("starcraft", 1.7),
            ("board_games", 1.65),
            ("history", 1.65),
            ("language_lore", 1.7),
            ("streetwise", 1.5),
            ("alchemy", 1.45),
            ("cartography", 1.45),
            ("religious_lore", 1.85),
        ),
        talent_avoid={},
        attribute_bias=attrs(CL=3, IN=2, CH=2, DE=1, CO=1, AG=0, CN=0, ST=0),
        advantage_pick_bias={
            "good_memory_i": 1.7,
            "social_chameleon": 1.5,
            "educated": 1.55,
            "outstanding_attribute": 1.4,
        },
        disadvantage_pick_bias={
            "curiosity": 1.6,
            "arrogance": 1.4,
        },
        spell_group_weight=0.4,
    ),
    "blessed_one_of_ifirn": profile(
        affinity=["wilderness", "healer", "divine"],
        group=groups(
            physical_talents=0.30,
            nature_talents=0.30,
            social_talents=0.15,
            lore_talents=0.10,
            combat_talents=0.08,
            artisan_talents=0.07,
        ),
        talent_bias=bias_map(
            ("perception", 1.8),
            ("survival", 1.9),
            ("track", 1.7),
            ("orientation", 1.8),
            ("weather_sense", 1.75),
            ("body_control", 1.65),
            ("self_control", 1.6),
            ("sneak", 1.5),
            ("hide", 1.45),
            ("swim", 1.45),
            ("treat_wounds", 1.55),
            ("human_nature", 1.5),
            ("persuade", 1.45),
            ("religious_lore", 1.75),
        ),
        talent_avoid={},
        attribute_bias=attrs(IN=2, CH=2, CN=2, AG=2, CO=2, CL=1, DE=1, ST=1),
        advantage_pick_bias={
            "danger_instinct": 1.7,
            "direction_sense": 1.6,
            "cold_resistance": 1.55,
            "luck": 1.5,
        },
        disadvantage_pick_bias={
            "curiosity": 1.35,
            "fear_of_sea": 0.2,
        },
    ),
    "blessed_one_of_aves": profile(
        affinity=["explorer", "social", "divine"],
        group=groups(
            physical_talents=0.22,
            nature_talents=0.22,
            social_talents=0.22,
            lore_talents=0.18,
            artisan_talents=0.10,
            combat_talents=0.06,
        ),
        talent_bias=bias_map(
            ("athletics", 1.75),
            ("climb", 1.8),
            ("perception", 1.85),
            ("streetwise", 1.7),
            ("human_nature", 1.65),
            ("fast_talk", 1.7),
            ("persuade", 1.65),
            ("orientation", 1.9),
            ("weather_sense", 1.75),
            ("survival", 1.8),
            ("geography", 2.0),
            ("language_lore", 1.85),
            ("cartography", 1.8),
            ("body_control", 1.5),
            ("religious_lore", 1.7),
        ),
        talent_avoid=avoid_map(
            ("swords", 0.3),
            ("infantry_weapons", 0.3),
            ("axes_and_maces", 0.3),
            ("two_handed_swords", 0.25),
            ("warcraft", 0.25),
        ),
        attribute_bias=attrs(IN=2, AG=2, CH=2, CO=1, CL=1, DE=1, CN=1, ST=0),
        advantage_pick_bias={
            "direction_sense": 1.7,
            "danger_instinct": 1.6,
            "luck": 1.55,
            "social_chameleon": 1.5,
            "mental_compass": 1.35,
        },
        disadvantage_pick_bias={
            "curiosity": 1.65,
            "claustrophobia": 1.4,
            "violent_temper": 0.45,
        },
    ),
    "blessed_one_of_ingerimm": profile(
        affinity=["artisan", "divine"],
        group=groups(
            artisan_talents=0.40,
            lore_talents=0.20,
            social_talents=0.15,
            physical_talents=0.12,
            combat_talents=0.08,
            nature_talents=0.05,
        ),
        talent_bias=bias_map(
            ("self_control", 1.85),
            ("teach", 1.6),
            ("persuade", 1.55),
            ("stone_lore", 1.9),
            ("mining", 1.85),
            ("blacksmith", 2.1),
            ("light_engineering", 1.8),
            ("engineering", 1.65),
            ("calculate", 1.7),
            ("appraise", 1.7),
            ("woodcraft", 1.55),
            ("stonemason", 1.65),
            ("stonecutter_jeweler", 1.55),
            ("carpenter", 1.45),
            ("alchemy", 1.4),
            ("religious_lore", 1.85),
        ),
        talent_avoid=avoid_map(
            ("fish", 0.25),
            ("swim", 0.3),
            ("seafaring", 0.25),
            ("boats", 0.3),
            ("juggling", 0.3),
        ),
        attribute_bias=attrs(DE=3, CN=2, ST=2, CL=2, IN=1, CO=1, CH=1, AG=0),
        advantage_pick_bias={
            "master_craft": 1.7,
            "good_memory_i": 1.5,
            "iron": 1.45,
            "enduring": 1.4,
            "aptitude_talent_group_other": 1.45,
        },
        disadvantage_pick_bias={
            "violent_temper": 1.45,
            "vanity": 1.35,
            "arrogance": 1.3,
        },
    ),
    "blessed_one_of_angrosch": profile(
        affinity=["artisan", "scholar", "divine"],
        group=groups(
            artisan_talents=0.38,
            lore_talents=0.22,
            social_talents=0.15,
            physical_talents=0.12,
            combat_talents=0.08,
            nature_talents=0.05,
        ),
        talent_bias=bias_map(
            ("self_control", 1.9),
            ("human_nature", 1.6),
            ("persuade", 1.55),
            ("stone_lore", 1.95),
            ("mining", 1.85),
            ("blacksmith", 2.05),
            ("light_engineering", 1.75),
            ("calculate", 1.7),
            ("appraise", 1.7),
            ("stonemason", 1.6),
            ("stonecutter_jeweler", 1.6),
            ("history", 1.55),
            ("heraldry", 1.4),
            ("religious_lore", 1.95),
        ),
        talent_avoid=avoid_map(
            ("swim", 0.25),
            ("seafaring", 0.2),
            ("boats", 0.25),
            ("fish", 0.3),
        ),
        attribute_bias=attrs(DE=3, CN=2, ST=2, CL=2, IN=1, CO=1, CH=1, AG=0),
        advantage_pick_bias={
            "hard_to_enspell": 1.7,
            "high_rm": 1.6,
            "twilight_sight": 1.45,
            "master_craft": 1.55,
            "iron": 1.45,
            "good_memory_i": 1.4,
        },
        disadvantage_pick_bias={
            "greed": 1.5,
            "prejudice": 1.4,
            "fear_of_sea": 1.35,
            "arrogance": 1.25,
        },
    ),
}


def apply_profile(prof, prof_data):
    note = prof_data.pop("note", None)
    talent_bias = merge_package_bias(prof, prof_data["talent_bias"])
    for key, val in prof_data.items():
        if key == "talent_bias":
            prof[key] = talent_bias
        else:
            prof[key] = val
    notes = list(prof.get("data_notes") or [])
    msg = (
        "Generation weights rematched from TDE4_1_Blessed_One_Likely_Talents_"
        "Advantages_Disadvantages.txt (WdG guiding talents)."
    )
    if msg not in notes:
        notes.append(msg)
    if note and note not in notes:
        notes.append(note)
    # Catalog gaps called out once
    gap = (
        "WdG guide talents not yet in catalog (bias skipped): statecraft, treat_soul, "
        "prophecy, trade, domestic_skills, smelting, brewing, architecture."
    )
    if gap not in notes:
        notes.append(gap)
    prof["data_notes"] = notes


def main():
    data = json.loads(PROF_PATH.read_text(encoding="utf-8"))
    profs = data["professions"]
    by_id = {p["id"]: p for p in profs}

    # Rename ids + names
    for old, new in ID_RENAME.items():
        if old not in by_id:
            print("WARN: missing", old)
            continue
        p = by_id[old]
        p["id"] = new
        if new in NAME_FIX:
            p["name"], p["german_name"] = NAME_FIX[new]
        notes = list(p.get("data_notes") or [])
        rename_note = "Renamed from misparsed id '%s' (WdH parent cult name)." % old
        if rename_note not in notes:
            notes.append(rename_note)
        p["data_notes"] = notes
        by_id[new] = p
        del by_id[old]
        print("renamed", old, "->", new)

    applied = []
    for pid, pdata in PROFILES.items():
        if pid not in by_id:
            print("WARN: no profession for profile", pid)
            continue
        apply_profile(by_id[pid], dict(pdata))
        applied.append(pid)

    # Preserve OrderedDict-ish dump with stable formatting
    PROF_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("applied weights to", len(applied), "professions")

    # Update cultures allowlists
    cult_text = CULT_PATH.read_text(encoding="utf-8")
    for old, new in ID_RENAME.items():
        cult_text = cult_text.replace('"%s"' % old, '"%s"' % new)
    CULT_PATH.write_text(cult_text, encoding="utf-8")
    print("updated cultures.json id references")


if __name__ == "__main__":
    main()

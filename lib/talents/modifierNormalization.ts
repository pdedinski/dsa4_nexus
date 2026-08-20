/**
 * Normalize race/culture/profession talent modifiers into canonical `TALENT_INDEX` ids.
 * Applies simple aliases (WdH synonyms), randomized composite "pick-one" modifiers, scripted
 * language slot keys, and profession `talent_choice_modifiers` with melee sentinels.
 */

import { TALENT_INDEX } from "./catalog";

export type TalentChoiceModifierJson = {
  choose?: number;
  from?: string[];
  value?: number;
  note?: string;
};

type EntityMods = {
  talent_modifiers?: Record<string, unknown>;
  talent_choice_modifiers?: TalentChoiceModifierJson[];
};

export type CultureForTalents = EntityMods & {
  language_entries?: Array<Record<string, unknown>>;
};

const SIMPLE_ALIASES: Record<string, string> = {
  bow: "bows",
  crossbow: "crossbows",
  maces: "axes_and_maces",
  bastard_swords: "bastard_sword",
  throwing_spear: "throwing_spears",
  throwing_axe: "throwing_axes",
  throwing_knife: "throwing_knives",
  fencing: "fencing_weapons",
  climbing: "climb",
  boating: "boats",
  swimming: "swim",
  tracking: "track",
  trapping: "trap",
  fishing: "fish",
  leatherwork: "leathercraft",
  tailoring: "tailor",
  woodworking: "woodcraft",
  woodwork: "woodcraft",
  willpower: "self_control",
  legends_tales: "legend_lore",
  religion_cult: "religious_lore",
  magic_lore: "arcane_lore",
  military_art: "warcraft",
  mimicry: "voice_mimicry",
  weather_forecasting: "weather_sense",
  wilderness_living: "survival",
  binding_escape: "bind_escape",
  disguise: "masquerade",
  board_card_games: "board_games",
  drawing_painting: "paint_draw",
  music: "play_instrument",
  mechanics: "light_engineering",
  fine_mechanics: "light_engineering",
  cooking: "cook",
  blacksmithing: "blacksmith",
  geology: "stone_lore",
  astronomy_astrology: "starcraft",
  cheating_gambling: "cheat",
  heal_wounds: "treat_wounds",
  heal_poison: "treat_poison",
  heal_disease: "treat_disease",
  heal_diseases: "treat_disease",
  pickpocket: "pick_pockets",
  lockpicking: "pick_locks",
  foreign_language: "language_lore",
  vehicle_driving: "drive",
  voice_imitation: "voice_mimicry",
  anatomy_or_surgery: "anatomy",
  two_handed_maces: "two_handed_blunt_weapons",
  arcane_script: "read_write_sacred_glyphs",
  read_write_kuslik_script: "read_write_kuslik",
};

const COMPOSITE_PICK_ONE: Record<string, readonly string[]> = {
  acrobatics_or_athletics_or_juggling_primary: [
    "acrobatics",
    "athletics",
    "juggling",
  ],
  acrobatics_or_athletics_or_juggling_secondary: [
    "acrobatics",
    "athletics",
    "juggling",
  ],
  animal_training_or_bowcraft: ["animal_training", "bowyer"],
  animal_training_or_bowcraft_or_fine_mechanics: [
    "animal_training",
    "bowyer",
    "light_engineering",
  ],
  animal_training_or_cheating_or_drawing_or_music_primary: [
    "animal_training",
    "cheat",
    "paint_draw",
    "play_instrument",
  ],
  animal_training_or_cheating_or_drawing_or_music_secondary: [
    "animal_training",
    "cheat",
    "paint_draw",
    "play_instrument",
  ],
  athletics_or_boating_or_riding_primary: ["athletics", "boats", "ride"],
  athletics_or_boating_or_riding_secondary: ["athletics", "boats", "ride"],
  athletics_or_boating_or_riding_tertiary: ["athletics", "boats", "ride"],
  athletics_or_riding_or_boating: ["athletics", "ride", "boats"],
  bowcraft_or_boating: ["bowyer", "boats"],
  butcher_or_tanner_furrier: ["butcher", "tanner_furrier"],
  climbing_or_boating: ["climb", "boats"],
  climbing_or_riding_primary: ["climb", "ride"],
  climbing_or_riding_secondary: ["climb", "ride"],
  cooking_or_mechanics_or_tailoring_or_starcraft_or_carpentry: [
    "cook",
    "light_engineering",
    "tailor",
    "starcraft",
    "carpenter",
  ],
  crossbow_or_bow_or_throwing_knives: [
    "crossbows",
    "bows",
    "throwing_knives",
  ],
  crossbow_or_bow_or_throwing_spear: [
    "crossbows",
    "bows",
    "throwing_spears",
  ],
  fencing_or_maces_or_sabers_or_swords: [
    "fencing_weapons",
    "axes_and_maces",
    "sabers",
    "swords",
  ],
  lockpicking_or_fine_mechanics: ["pick_locks", "light_engineering"],
  maces_or_sabers: ["axes_and_maces", "sabers"],
  maces_or_sabers_or_staves: ["axes_and_maces", "sabers", "staves"],
  maces_or_staves: ["axes_and_maces", "staves"],
  singing_or_dancing: ["sing", "dance"],
  sneak_or_hide_primary: ["sneak", "hide"],
  sneak_or_hide_secondary: ["sneak", "hide"],
  spears_or_staves: ["spears", "staves"],
  throwing_knives_or_throwing_axes: ["throwing_knives", "throwing_axes"],
  two_handed_swords_or_sabers: ["two_handed_swords", "sabers"],
  pharmacy_or_herbalism: ["plant_lore", "alchemy", "treat_poison"],
};

const MOTHER_LANGUAGE_TO_RW: Record<string, string> = {
  garethi: "read_write_kuslik",
  garethi_as_horathi: "read_write_kuslik",
  tulamidya: "read_write_tulamidyan",
  rogolan: "read_write_rogolan",
  thorwalian: "read_write_hjaldingr",
  isdira: "read_write_isdira",
};

const SPOKEN_LANGUAGE_CODES: Record<string, string> = {
  tulamidya: "tongue_tulamidya",
  bosparano: "tongue_bosparano",
  thorwalian: "tongue_thorwalian",
  rogolan: "tongue_rogolan",
  garethi: "tongue_garethi",
};

const SKIP_FLAT_KEYS = new Set([
  "primary_weapon",
  "secondary_weapon",
  "ranged_weapon",
]);

const FOREIGN_TONGUE_IDS: readonly string[] = (() => {
  const ids: string[] = [];
  for (const id of TALENT_INDEX.keys()) {
    if (id.startsWith("tongue_") && id !== "tongue_mother") ids.push(id);
  }
  return ids;
})();

const LORE_FOCUS_IDS = [
  "history",
  "legend_lore",
  "geography",
  "religious_lore",
  "warcraft",
  "animal_lore",
  "plant_lore",
  "stone_lore",
  "engineering",
  "arcane_lore",
  "heraldry",
  "law",
  "language_lore",
  "calculate",
].filter((id) => TALENT_INDEX.has(id));

const READ_WRITE_IDS = [...TALENT_INDEX.keys()].filter((id) =>
  id.startsWith("read_write_"),
);

function pick<N>(rng: () => number, arr: readonly N[]): N | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

function pickDistinct(
  rng: () => number,
  pool: readonly string[],
  n: number,
  forbid: ReadonlySet<string>,
  prefer?: ReadonlySet<string>,
): string[] {
  let avail = [...new Set(pool)].filter((x) => !forbid.has(x));
  const out: string[] = [];
  const used = new Set(forbid);
  while (out.length < n && avail.length) {
    const c = avail.filter((x) => !used.has(x));
    if (!c.length) break;
    const preferred = prefer?.size
      ? c.filter((x) => prefer.has(x))
      : [];
    const ch = pick(rng, preferred.length ? preferred : c)!;
    out.push(ch);
    used.add(ch);
    avail = avail.filter((x) => !used.has(x));
  }
  return out;
}

function catalogIdForRawTalentKey(rawKey: string): string | undefined {
  const trimmed = rawKey.trim();
  if (!trimmed || COMPOSITE_PICK_ONE[trimmed]) return undefined;
  let k = SIMPLE_ALIASES[trimmed] ?? trimmed;
  for (let guard = 0; guard < 10; guard++) {
    const n = SIMPLE_ALIASES[k];
    if (!n || n === k) break;
    k = n;
  }
  return TALENT_INDEX.has(k) ? k : undefined;
}

function resolveComposite(randomKey: string, rng: () => number): string | undefined {
  const grp = COMPOSITE_PICK_ONE[randomKey];
  if (!grp) return undefined;
  const opts: string[] = [];
  for (const token of grp) {
    let id = SIMPLE_ALIASES[token] ?? token;
    for (let guard = 0; guard < 10; guard++) {
      const n = SIMPLE_ALIASES[id];
      if (!n || n === id) break;
      id = n;
    }
    if (TALENT_INDEX.has(id)) opts.push(id);
  }
  const uniq = [...new Set(opts)];
  return uniq.length ? pick(rng, uniq) : undefined;
}

function sentinelPrimaryRemaining(fromRaw: unknown): boolean {
  if (!Array.isArray(fromRaw) || fromRaw.length !== 1) return false;
  const s = String(fromRaw[0]);
  return s === "remaining_from_primary" || s === "remaining_from_primary_list";
}

function sentinelMacesSabers(fromRaw: unknown): boolean {
  if (!Array.isArray(fromRaw) || fromRaw.length !== 1) return false;
  return String(fromRaw[0]) === "remaining_maces_sabers";
}

function meleeMacesSabersOnly(poolCanon: readonly string[]): boolean {
  const s = new Set(poolCanon);
  return s.size === 2 && s.has("axes_and_maces") && s.has("sabers");
}

function validCanonFromRaw(from: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of from) {
    const canon = catalogIdForRawTalentKey(raw);
    if (canon) out.add(canon);
  }
  return [...out];
}

function talentModifierPlus(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && "value" in raw) {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function addTp(m: Record<string, number>, id: string, v: number) {
  if (!v) return;
  m[id] = (m[id] ?? 0) + v;
}

type PoolPick = { pool: readonly string[]; picked: string };

function applyProfessionChoices(
  rng: () => number,
  blocksRaw: TalentChoiceModifierJson[] | undefined,
  out: Record<string, number>,
  preferTalentIds?: ReadonlySet<string>,
) {
  const blocks =
    blocksRaw?.filter(
      (b) =>
        typeof b.choose === "number" &&
        typeof b.value === "number" &&
        Array.isArray(b.from)
    ) ?? [];
  let meleeForSentinel: PoolPick | undefined;
  let macesForSentinel: PoolPick | undefined;

  for (let i = 0; i < blocks.length; i++) {
    const blk = blocks[i]!;
    const val = blk.value!;
    let choose = Math.max(1, blk.choose ?? 1);
    const next = blocks[i + 1];

    if (sentinelPrimaryRemaining(blk.from)) {
      const poolCanon = meleeForSentinel
        ? meleeForSentinel.pool.filter((x) => x !== meleeForSentinel!.picked)
        : [];
      meleeForSentinel = undefined;
      const picks = pickDistinct(
        rng,
        poolCanon,
        Math.min(choose, poolCanon.length),
        new Set(),
        preferTalentIds,
      );
      for (const p of picks) addTp(out, p, val);
      continue;
    }

    if (sentinelMacesSabers(blk.from)) {
      const poolCanon = macesForSentinel
        ? macesForSentinel.pool.filter((x) => x !== macesForSentinel!.picked)
        : [];
      macesForSentinel = undefined;
      const picks = pickDistinct(
        rng,
        poolCanon,
        Math.min(choose, poolCanon.length),
        new Set(),
        preferTalentIds,
      );
      for (const p of picks) addTp(out, p, val);
      continue;
    }

    let poolCanon = validCanonFromRaw(blk.from!);

    if (meleeMacesSabersOnly(poolCanon) && next && sentinelMacesSabers(next.from)) {
      choose = Math.min(choose, 1);
      const picks = pickDistinct(
        rng,
        poolCanon,
        choose,
        new Set(),
        preferTalentIds,
      );
      for (const p of picks) addTp(out, p, val);
      if (picks.length === 1)
        macesForSentinel = { pool: poolCanon, picked: picks[0]! };
      continue;
    }

    const picks =
      poolCanon.length > 0
        ? pickDistinct(
            rng,
            poolCanon,
            Math.min(choose, poolCanon.length),
            new Set(),
            preferTalentIds,
          )
        : [];
    for (const p of picks) addTp(out, p, val);

    if (
      next &&
      sentinelPrimaryRemaining(next.from) &&
      picks.length === 1 &&
      poolCanon.length > 1
    ) {
      meleeForSentinel = { pool: poolCanon, picked: picks[0]! };
    }
  }
}

function tradeLanguageTalentPool(culture: CultureForTalents): string[] {
  const fromCulture = culture.language_entries ?? [];
  const out: string[] = [];
  for (const e of fromCulture) {
    if ((e as { type?: unknown }).type !== "trade_language_choice") continue;
    const opts = (e as { options?: string[] }).options;
    if (!Array.isArray(opts)) continue;
    for (const o of opts) {
      const k = typeof o === "string" ? SPOKEN_LANGUAGE_CODES[o] : undefined;
      if (k && TALENT_INDEX.has(k)) out.push(k);
    }
  }
  return out.length ? [...new Set(out)] : [...FOREIGN_TONGUE_IDS];
}

function motherRw(culture: CultureForTalents): string | undefined {
  const mt = culture.language_entries?.find(
    (e) => (e as { type?: unknown }).type === "mother_tongue"
  ) as { language?: string } | undefined;
  const code = mt?.language?.toLowerCase().replace(/\s+/g, "_");
  const rw = code ? MOTHER_LANGUAGE_TO_RW[code] : undefined;
  return rw && TALENT_INDEX.has(rw) ? rw : undefined;
}

function applyFlatTalentModifiers(
  rng: () => number,
  talentModifiers: Record<string, unknown> | undefined,
  culture: CultureForTalents,
  out: Record<string, number>
) {
  if (!talentModifiers) return;

  let throwPrimaryChosen: string | undefined;
  const foreignSlots = new Map<string, number>();
  const focusSlots = new Map<string, number>();

  for (const [rawKey, rawVal] of Object.entries(talentModifiers)) {
    const tp = talentModifierPlus(rawVal);
    if (tp === 0) continue;

    const fkMatch = /^foreign_language_(\d+)$/.exec(rawKey);
    if (fkMatch) {
      foreignSlots.set(`f${fkMatch[1]}`, tp);
      continue;
    }
    const lkMatch = /^focus_lore_(\d+)$/.exec(rawKey);
    if (lkMatch) {
      focusSlots.set(`k${lkMatch[1]}`, tp);
      continue;
    }

    if (SKIP_FLAT_KEYS.has(rawKey)) continue;

    const comp = resolveComposite(rawKey, rng);
    if (comp) {
      addTp(out, comp, tp);
      continue;
    }

    if (rawKey === "throwing_weapon_primary") {
      const sid = pick(rng, [
        "throwing_knives",
        "throwing_axes",
        "throwing_spears",
      ]);
      if (sid) {
        throwPrimaryChosen = sid;
        addTp(out, sid, tp);
      }
      continue;
    }
    if (rawKey === "throwing_weapon_secondary") {
      const pool = [
        "throwing_knives",
        "throwing_axes",
        "throwing_spears",
      ].filter((x) => x !== throwPrimaryChosen);
      const sid = pick(rng, pool.length ? pool : ["throwing_knives"]);
      if (sid) addTp(out, sid, tp);
      continue;
    }

    switch (rawKey) {
      case "own_script":
      case "read_write_own_script": {
        const rw = motherRw(culture);
        if (rw) addTp(out, rw, tp);
        break;
      }
      case "other_script_1":
      case "other_script_2": {
        const own = motherRw(culture);
        const cand = READ_WRITE_IDS.filter((id) => id !== own);
        const sid = pick(rng, cand);
        if (sid) addTp(out, sid, tp);
        break;
      }
      case "trade_language_1":
      case "trade_language_2": {
        const cand = tradeLanguageTalentPool(culture);
        const sid = pick(rng, cand);
        if (sid) addTp(out, sid, tp);
        break;
      }
      default: {
        const sid = catalogIdForRawTalentKey(rawKey);
        if (sid) addTp(out, sid, tp);
        break;
      }
    }
  }

  let usedFocus = new Set<string>();
  for (const key of [...focusSlots.keys()].sort()) {
    const pool = LORE_FOCUS_IDS.filter((x) => !usedFocus.has(x));
    const p = pick(rng, pool);
    if (!p) break;
    usedFocus.add(p);
    addTp(out, p, focusSlots.get(key)!);
  }

  let usedTongues = new Set<string>();
  const tradePoolSeq = [...tradeLanguageTalentPool(culture)];
  let tpIdx = 0;
  for (const key of [...foreignSlots.keys()].sort()) {
    const prefer = tpIdx < tradePoolSeq.length ? tradePoolSeq[tpIdx++] : undefined;
    let cand = FOREIGN_TONGUE_IDS.filter((x) => !usedTongues.has(x));
    if (prefer && !usedTongues.has(prefer)) cand = [prefer, ...cand];
    const p = pick(rng, cand.length ? cand : FOREIGN_TONGUE_IDS);
    if (!p) break;
    usedTongues.add(p);
    addTp(out, p, foreignSlots.get(key)!);
  }
}

function applyTalentChoicesRaceCulture(
  rng: () => number,
  blocksRaw: TalentChoiceModifierJson[] | undefined,
  out: Record<string, number>
) {
  const blocks =
    blocksRaw?.filter(
      (b) =>
        typeof b.choose === "number" &&
        typeof b.value === "number" &&
        Array.isArray(b.from)
    ) ?? [];
  for (const blk of blocks) {
    const poolCanon = validCanonFromRaw(blk.from!);
    const choose = blk.choose ?? 1;
    const picks = pickDistinct(
      rng,
      poolCanon,
      Math.min(choose, poolCanon.length),
      new Set()
    );
    for (const p of picks) addTp(out, p, blk.value!);
  }
}

/** Baseline TP after canonicalisation / randomized binds used at character creation. */
export function mergeTalentModifiersNormalized(
  rng: () => number,
  race: EntityMods & Record<string, unknown>,
  culture: CultureForTalents & Record<string, unknown>,
  profession: EntityMods & Record<string, unknown>,
  preferTalentIds?: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};

  applyTalentChoicesRaceCulture(rng, race.talent_choice_modifiers, out);
  applyFlatTalentModifiers(rng, race.talent_modifiers, culture, out);

  applyTalentChoicesRaceCulture(rng, culture.talent_choice_modifiers, out);
  applyFlatTalentModifiers(rng, culture.talent_modifiers, culture, out);

  applyProfessionChoices(
    rng,
    profession.talent_choice_modifiers,
    out,
    preferTalentIds,
  );
  applyFlatTalentModifiers(rng, profession.talent_modifiers, culture, out);

  return out;
}

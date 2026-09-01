/**
 * Export hero to legacy Java Chargen NanoXML `<Held>` (.dcg) format.
 * Layout mirrors FactoryHeldXmlOut / FactoryHeldXmlIn expectations.
 *
 * Export target is current Java Chargen: required ints/bools always written,
 * Variante as attribute only (import still accepts child Variante for old files).
 */

import type { HeldModel } from "@/lib/chargen/types";
import {
  ATTR_TO_GERMAN,
  DERIVED_TO_GERMAN,
} from "@/lib/chargen/types";
import { getBuiltinCatalog } from "@/lib/chargen/data/builtinCatalog";
import {
  meleeWertFromCatalog,
  rangedWertFromCatalog,
  shieldWertFromCatalog,
} from "@/lib/chargen/rules/equipmentWert";
import { isCombatTalent } from "@/lib/chargen/rules/talentActivation";
import {
  isTalentGroupTrait,
  javaTalentGroupVariant,
} from "@/lib/chargen/rules/talentGroupVariants";
import { traitDerivedMod } from "@/lib/chargen/rules/derived";

const INDENT = "    ";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name: string, value: string | number): string {
  const s = esc(String(value));
  if (!s) return `<${name}/>`;
  return `<${name}>${s}</${name}>`;
}

/** FactoryHeldXmlOut writes Variante as an attribute only (never a child element). */
function selfClosing(tagName: string, attrs: string): string {
  return `<${tagName} ${attrs}/>`;
}

function withVarianteAttr(attrs: string, variant?: string): string {
  if (!variant) return attrs;
  if (/\bVariante=/.test(attrs)) return attrs;
  return `${attrs} Variante="${esc(variant)}"`;
}

function csvInts(vals: number[] | undefined, fallback: number[]): string {
  const list = vals?.length ? vals : fallback;
  return list.join(",");
}

function resolveMotherTongue(held: HeldModel): string | undefined {
  if (held.motherTongue) return held.motherTongue;
  if (!held.cultureId) return undefined;
  const culture = getBuiltinCatalog("cultures").find(
    (c) => c.id === held.cultureId
  );
  const tongue = culture?.mother_tongue;
  return tongue != null ? String(tongue) : undefined;
}

function catalogById(
  category: "melee_weapons" | "ranged_weapons" | "shields",
  id: string
) {
  return getBuiltinCatalog(category).find((c) => c.id === id);
}

type SfMeta = {
  variant_source?: string | null;
  free_variant?: boolean;
  expand_template?: string | null;
};

/** Java Sonderfertigkeit.hatVarianten() — missing Variante → NPE in FactoryHeldXmlIn. */
function sfRequiresVariant(meta: SfMeta | undefined): boolean {
  if (!meta) return false;
  if (meta.variant_source) return true;
  if (meta.free_variant) return true;
  const t = meta.expand_template;
  return t === "talent_specialization" || t === "weapon_specialization";
}

function sfAllowsFreeVariant(meta: SfMeta | undefined): boolean {
  if (!meta) return false;
  return (
    meta.free_variant === true ||
    meta.variant_source === "free_text" ||
    meta.expand_template === "talent_specialization" ||
    meta.expand_template === "weapon_specialization"
  );
}

function packageSfVariantHint(
  held: HeldModel,
  sfId: string
): string | undefined {
  for (const cat of ["races", "cultures", "professions"] as const) {
    const id =
      cat === "races"
        ? held.raceId
        : cat === "cultures"
          ? held.cultureId
          : held.professionId;
    if (!id) continue;
    const item = getBuiltinCatalog(cat).find((c) => c.id === id);
    if (!item) continue;
    const bonuses =
      (item.special_ability_bonuses as Array<{
        id?: string;
        variant?: string | null;
        description?: string | null;
        open?: boolean;
        choices?: Array<{ id?: string; variant?: string | null }>;
      }>) || [];
    for (const b of bonuses) {
      if (b.open && b.choices) {
        const hit = b.choices.find((c) => c.id === sfId && (c.variant || ""));
        if (hit?.variant) return String(hit.variant);
        continue;
      }
      if (b.id === sfId) {
        const v = b.variant || b.description;
        if (v) return String(v);
      }
    }
    const cheap =
      (item.discounted_special_ability_variants as Array<{
        id?: string;
        variant?: string | null;
        description?: string | null;
      }>) || [];
    for (const c of cheap) {
      if (c.id !== sfId) continue;
      const v = c.variant || c.description;
      if (v) return String(v);
    }
  }
  return undefined;
}

function resolveSfVariantForExport(
  held: HeldModel,
  sf: { id: string; variant?: string }
): string | undefined {
  if (sf.variant) return sf.variant;
  const recovered = packageSfVariantHint(held, sf.id);
  if (recovered) return recovered;
  const meta = getBuiltinCatalog("special_abilities").find(
    (c) => c.id === sf.id
  ) as SfMeta | undefined;
  if (!sfRequiresVariant(meta)) return undefined;
  // Free-text variants (Ortskenntnis, specializations): any non-null string avoids NPE.
  if (sfAllowsFreeVariant(meta)) return "?";
  return undefined;
}

function specializationNeedsTalent(sfId: string): boolean {
  return (
    sfId === "Sonderfertigkeit.Talentspezialisierung" ||
    sfId === "Sonderfertigkeit.Waffenspezialisierung" ||
    sfId === "Sonderfertigkeit.Scharfschuetze"
  );
}

/**
 * Live package portion of a derived mod: race/culture/profession + trait mods.
 * Must match what `recomputeDerived` folds into `packageBaseline` so XML Bonus
 * stays player-only (Spellcaster +12 ASP must not be written as Bonus).
 */
function packageDerivedBonus(held: HeldModel, code: string): number {
  let n = 0;
  for (const cat of ["races", "cultures", "professions"] as const) {
    const id =
      cat === "races"
        ? held.raceId
        : cat === "cultures"
          ? held.cultureId
          : held.professionId;
    if (!id) continue;
    const item = getBuiltinCatalog(cat).find((c) => c.id === id);
    const mods = item?.derived_modifiers as Record<string, number> | undefined;
    n += mods?.[code] ?? 0;
  }
  return n + traitDerivedMod(held, code);
}

function isKampfTalentId(talentId: string): boolean {
  const meta = getBuiltinCatalog("talents").find((t) => t.id === talentId);
  return meta ? isCombatTalent(meta) : false;
}

export function exportLegacyHeldXml(held: HeldModel): string {
  const lines: string[] = ["<Held>"];
  const push = (level: number, s: string) => {
    lines.push(INDENT.repeat(level) + s);
  };

  push(1, tag("Name", held.name));
  push(1, tag("Rasse", held.raceId));
  push(1, tag("Kultur", held.cultureId));
  push(1, tag("Profession", held.professionId));
  push(
    1,
    tag("Geschlecht", held.gender === "female" ? "WEIBLICH" : "MAENNLICH")
  );
  push(1, tag("Geburtstag", held.birthday || "1. Praios, 1 Hal"));
  push(1, tag("Alter", held.age));
  push(1, tag("Groesse", held.heightCm));
  push(1, tag("Gewicht", held.weightKg));
  push(1, tag("Haarfarbe", held.hairColor));
  push(1, tag("Augenfarbe", held.eyeColor));
  push(1, tag("Aussehen", held.appearance));
  push(1, tag("Stand", held.status));
  push(1, tag("Titel", held.title));
  push(1, tag("Hintergrund", held.background));
  // FactoryHeldXmlOut writes apGesamt even when 0 — do not fall back to apSpent.
  push(1, tag("GesamtAp", held.apTotal ?? 0));
  push(1, tag("EingesetzteAp", held.apSpent ?? 0));

  push(1, "<EigenschaftWerte>");
  for (const a of held.attributes) {
    const german = ATTR_TO_GERMAN[a.code];
    if (!german) continue;
    push(
      2,
      selfClosing(
        "EigenschaftWert",
        [
          `Eigenschaft="${esc(german)}"`,
          `Basisstufe="${a.base}"`,
          `Zukauf="${a.purchased ?? 0}"`,
          `SpezielleErfahrung="${a.specialExperience ? "true" : "false"}"`,
        ].join(" ")
      )
    );
  }
  push(1, "</EigenschaftWerte>");

  push(1, "<BasiswertWerte>");
  for (const d of held.derived) {
    // GS (Speed) is computed by Java Held.getGeschwindigkeit() — not a Basiswert.
    if (d.code === "GS") continue;
    const german = DERIVED_TO_GERMAN[d.code as Exclude<typeof d.code, "GS">];
    if (!german) continue;
    // After DCG import (xmlBonusOnly), modification is XML Bonus only.
    // After recomputeDerived, packageBaseline is the folded package portion.
    // When unset (DB load), assume modification already includes live package mods.
    // Legacy sticky packageBaseline=0 with folded package: fall back to live package.
    let pkgInMod: number;
    if (d.xmlBonusOnly) {
      pkgInMod = 0;
    } else if (d.packageBaseline !== undefined && d.packageBaseline !== 0) {
      pkgInMod = d.packageBaseline;
    } else if (d.packageBaseline === 0) {
      // Ambiguous: real zero package vs old import sentinel. Use live package.
      pkgInMod = packageDerivedBonus(held, d.code);
    } else {
      pkgInMod = packageDerivedBonus(held, d.code);
    }
    const xmlBonus = d.modification - pkgInMod;
    push(
      2,
      selfClosing(
        "BasiswertWert",
        [
          `Basiswert="${esc(german)}"`,
          `Bonus="${xmlBonus}"`,
          `Zukauf="${d.purchased ?? 0}"`,
          `SpezielleErfahrung="${d.specialExperience ? "true" : "false"}"`,
        ].join(" ")
      )
    );
  }
  push(1, "</BasiswertWerte>");

  // Muttersprache is required by FactoryHeldXmlIn.ermitteleMuttersprache.
  const motherTongue = resolveMotherTongue(held);
  if (motherTongue) push(1, tag("Muttersprache", motherTongue));
  if (held.secondLanguage) push(1, tag("Zweitsprache", held.secondLanguage));

  push(1, "<TalentWerte>");
  for (const t of held.talents) {
    const attrs = [
      `Talent="${esc(t.id)}"`,
      `UnmodifizierteStufe="${t.tp ?? 0}"`,
      `SpezielleErfahrung="${t.specialExperience ? "true" : "false"}"`,
    ];
    // FactoryHeldXmlOut writes Attacke for every Kampf talent.
    if (isKampfTalentId(t.id) || t.attack != null) {
      attrs.push(`Attacke="${t.attack ?? 0}"`);
    }
    // Aktiviert="false" only when inactive (Java also gates on effective level 0).
    if (t.activated === false) {
      attrs.push('Aktiviert="false"');
    }
    push(2, selfClosing("TalentWert", attrs.join(" ")));
  }
  push(1, "</TalentWerte>");

  if (held.leadTalents.length) {
    push(1, "<Leittalente>");
    for (const id of held.leadTalents) {
      push(2, `<Talent>${esc(id)}</Talent>`);
    }
    push(1, "</Leittalente>");
  }

  if (held.spells.length) {
    push(1, "<ZauberWerte>");
    for (const s of held.spells) {
      const attrs = withVarianteAttr(
        [
          `Zauber="${esc(s.id)}"`,
          `Stufe="${s.sp ?? 0}"`,
          `SpezielleErfahrung="${s.specialExperience ? "true" : "false"}"`,
        ].join(" "),
        s.variant
      );
      push(2, selfClosing("ZauberWert", attrs));
    }
    push(1, "</ZauberWerte>");
  }

  if (held.houseSpells.length) {
    push(1, "<Hauszauber>");
    for (const id of held.houseSpells) {
      push(2, `<Zauber>${esc(id)}</Zauber>`);
    }
    push(1, "</Hauszauber>");
  }
  if (held.leadSpells.length) {
    push(1, "<Leitzauber>");
    for (const id of held.leadSpells) {
      push(2, `<Zauber>${esc(id)}</Zauber>`);
    }
    push(1, "</Leitzauber>");
  }

  if (held.specialAbilities.length) {
    const sfLines: string[] = [];
    for (const s of held.specialAbilities) {
      if (!s.id) continue;
      if (specializationNeedsTalent(s.id) && !s.talent) continue;
      const meta = getBuiltinCatalog("special_abilities").find(
        (c) => c.id === s.id
      ) as SfMeta | undefined;
      const variant = resolveSfVariantForExport(held, s);
      if (sfRequiresVariant(meta) && !variant) continue;
      const attrs = withVarianteAttr(
        [
          `Sonderfertigkeit="${esc(s.id)}"`,
          s.talent ? `Talent="${esc(s.talent)}"` : "",
        ]
          .filter(Boolean)
          .join(" "),
        variant
      );
      sfLines.push(selfClosing("SonderfertigkeitWert", attrs));
    }
    if (sfLines.length) {
      push(1, "<SonderfertigkeitWerte>");
      for (const line of sfLines) push(2, line);
      push(1, "</SonderfertigkeitWerte>");
    }
  }

  if (held.discountedSpecialAbilities.length) {
    push(1, "<VerbilligteSonderfertigkeiten>");
    for (const id of held.discountedSpecialAbilities) {
      if (specializationNeedsTalent(id)) continue;
      push(
        2,
        selfClosing("Sonderfertigkeit", `Sonderfertigkeit="${esc(id)}"`)
      );
    }
    push(1, "</VerbilligteSonderfertigkeiten>");
  }

  if (held.discountedSpecialAbilityVariants?.length) {
    const vvLines: string[] = [];
    for (const v of held.discountedSpecialAbilityVariants) {
      if (!v.id) continue;
      if (specializationNeedsTalent(v.id) && !v.talent) continue;
      const meta = getBuiltinCatalog("special_abilities").find(
        (c) => c.id === v.id
      ) as SfMeta | undefined;
      const variant =
        v.variant ||
        packageSfVariantHint(held, v.id) ||
        (sfAllowsFreeVariant(meta) ? "?" : undefined);
      if (sfRequiresVariant(meta) && !variant) continue;
      const attrs = withVarianteAttr(
        [
          `Sonderfertigkeit="${esc(v.id)}"`,
          v.talent ? `Talent="${esc(v.talent)}"` : "",
        ]
          .filter(Boolean)
          .join(" "),
        variant
      );
      vvLines.push(selfClosing("SonderfertigkeitWert", attrs));
    }
    if (vvLines.length) {
      push(1, "<VerbilligteVarianten>");
      for (const line of vvLines) push(2, line);
      push(1, "</VerbilligteVarianten>");
    }
  }

  if (held.advantagesDisadvantages.length) {
    const TRAITS_FIXED_VARIANT = new Set([
      "VorNachteil.BegabungFuerTalent",
      "VorNachteil.BegabungFuerTalentgruppe",
      "VorNachteil.BesondererBesitz",
      "VorNachteil.ImmunitaetGegenGift",
      "VorNachteil.ImmunitaetGegenGiftart",
      "VorNachteil.ImmunitaetGegenKrankheit",
      "VorNachteil.Meisterhandwerk",
      "VorNachteil.ResistenzGegenGift",
      "VorNachteil.ResistenzGegenGiftart",
      "VorNachteil.UebernatuerlicheBegabung",
      "VorNachteil.UnfaehigkeitFuerTalent",
      "VorNachteil.UnfaehigkeitFuerTalentgruppe",
    ]);
    const TRAITS_FREE_VARIANT = new Set([
      "VorNachteil.Verbindungen",
      "VorNachteil.AngstVor1",
      "VorNachteil.AngstVor2",
      "VorNachteil.SchlechteEigenschaft1",
      "VorNachteil.SchlechteEigenschaft2",
      "VorNachteil.SchlechteEigenschaft3",
      "VorNachteil.SchlechteEigenschaft4",
      "VorNachteil.Verpflichtungen",
      "VorNachteil.Vorurteile1",
      "VorNachteil.Vorurteile2",
      "VorNachteil.Weltfremd",
    ]);

    function packageTraitVariantHint(traitId: string): string | undefined {
      for (const cat of ["races", "cultures", "professions"] as const) {
        const pkgId =
          cat === "races"
            ? held.raceId
            : cat === "cultures"
              ? held.cultureId
              : held.professionId;
        if (!pkgId) continue;
        const item = getBuiltinCatalog(cat).find((c) => c.id === pkgId);
        if (!item) continue;
        for (const key of [
          "advantage_bonuses",
          "disadvantage_bonuses",
        ] as const) {
          const list =
            (item[key] as Array<{
              id?: string;
              variant?: string | null;
              open?: boolean;
              choices?: Array<{ id?: string; variant?: string | null }>;
            }>) || [];
          for (const b of list) {
            if (b.open && b.choices) {
              const hit = b.choices.find(
                (c) => c.id === traitId && (c.variant || "")
              );
              if (hit?.variant) return String(hit.variant);
              continue;
            }
            if (b.id === traitId && b.variant) return String(b.variant);
          }
        }
        if (traitId === "VorNachteil.BesondererBesitz") {
          const possessions = item.special_possessions as string[] | undefined;
          if (possessions?.length) return String(possessions[0]);
        }
      }
      return undefined;
    }

    const vnLines: string[] = [];
    for (const t of held.advantagesDisadvantages) {
      if (!t.id) continue;
      const needsFixed = TRAITS_FIXED_VARIANT.has(t.id);
      const needsFree = TRAITS_FREE_VARIANT.has(t.id);
      let variant = t.variant || undefined;
      if ((needsFixed || needsFree) && !variant) {
        variant = packageTraitVariantHint(t.id);
      }
      if (variant && isTalentGroupTrait(t.id)) {
        variant = javaTalentGroupVariant(variant) || variant;
      }
      if (needsFixed && !variant) continue;
      if (needsFree && !variant) variant = "?";
      const attrs = withVarianteAttr(
        [
          `VorNachteil="${esc(t.id)}"`,
          t.specialExperience ? 'SpezielleErfahrung="true"' : "",
          t.rating != null ? `Stufe="${t.rating}"` : "",
        ]
          .filter(Boolean)
          .join(" "),
        variant
      );
      vnLines.push(selfClosing("VorNachteilWert", attrs));
    }
    if (vnLines.length) {
      push(1, "<VorNachteilWerte>");
      for (const line of vnLines) push(2, line);
      push(1, "</VorNachteilWerte>");
    }
  }

  if (held.meleeWeapons.length) {
    push(1, "<NahkampfwaffeWerte>");
    for (const w of held.meleeWeapons) {
      const cat = catalogById("melee_weapons", w.id);
      const seeded = cat ? meleeWertFromCatalog(cat) : undefined;
      const talent = w.talent || seeded?.talent || "";
      const tp = w.tp || seeded?.tp || "1W6";
      const dkH = w.dkH ?? seeded?.dkH ?? false;
      const dkN = w.dkN ?? seeded?.dkN ?? false;
      const dkS = w.dkS ?? seeded?.dkS ?? false;
      const bf = w.bf ?? seeded?.bf ?? 0;
      const ini = w.ini ?? seeded?.ini ?? 0;
      const wmAt = w.wmAt ?? seeded?.wmAt ?? 0;
      const wmPa = w.wmPa ?? seeded?.wmPa ?? 0;
      const step = w.damageStep ?? seeded?.damageStep ?? 0;
      const thr = w.damageThreshold ?? seeded?.damageThreshold ?? 0;
      // FactoryHeldXmlOut attribute order; FactoryHeldXmlIn requires all ints.
      const attrs = [
        `Bf="${bf}"`,
        `DkH="${dkH ? "true" : "false"}"`,
        `DkN="${dkN ? "true" : "false"}"`,
        `DkS="${dkS ? "true" : "false"}"`,
        `Ini="${ini}"`,
        `Name="${esc(w.name || seeded?.name || w.id)}"`,
        `Schadensschritt="${step}"`,
        `Schwellenwert="${thr}"`,
        `Talent="${esc(talent)}"`,
        `Tp="${esc(tp)}"`,
        `Nahkampfwaffe="${esc(w.id)}"`,
        `WmAt="${wmAt}"`,
        `WmPa="${wmPa}"`,
      ].join(" ");
      push(2, selfClosing("NahkampfwaffeWert", attrs));
    }
    push(1, "</NahkampfwaffeWerte>");
  }

  if (held.rangedWeapons.length) {
    push(1, "<FernkampfwaffeWerte>");
    for (const w of held.rangedWeapons) {
      const cat = catalogById("ranged_weapons", w.id);
      const seeded = cat ? rangedWertFromCatalog(cat) : undefined;
      const talent = w.talent || seeded?.talent;
      const tp = w.tp || seeded?.tp || "1W6";
      const ranges = csvInts(w.ranges, seeded?.ranges ?? [0, 0, 0, 0, 0]);
      const tpPlus = csvInts(w.tpPlus, seeded?.tpPlus ?? [0, 0, 0, 0, 0]);
      const attrs = [
        `Fernkampfwaffe="${esc(w.id)}"`,
        `Name="${esc(w.name || seeded?.name || w.id)}"`,
        `Reichweiten="${ranges}"`,
        talent ? `Talent="${esc(talent)}"` : "",
        `Tp="${esc(tp)}"`,
        `TpPlus="${tpPlus}"`,
      ]
        .filter(Boolean)
        .join(" ");
      push(2, selfClosing("FernkampfwaffeWert", attrs));
    }
    push(1, "</FernkampfwaffeWerte>");
  }

  if (held.armors.length) {
    push(1, "<RuestungWerte>");
    for (const a of held.armors) {
      // FactoryHeldXmlOut order: Be, Name, Ruestung, Rs
      push(
        2,
        selfClosing(
          "RuestungWert",
          [
            `Be="${a.be ?? 0}"`,
            `Name="${esc(a.name || a.id)}"`,
            `Ruestung="${esc(a.id)}"`,
            `Rs="${a.rs ?? 0}"`,
          ].join(" ")
        )
      );
    }
    push(1, "</RuestungWerte>");
  }

  if (held.shields.length) {
    push(1, "<SchildWerte>");
    for (const s of held.shields) {
      const cat = catalogById("shields", s.id);
      const seeded = cat ? shieldWertFromCatalog(cat) : undefined;
      const typ = s.type || seeded?.type || "SchildTyp.klein";
      push(
        2,
        selfClosing(
          "SchildWert",
          [
            `Bf="${s.bf ?? seeded?.bf ?? 0}"`,
            `Ini="${s.ini ?? seeded?.ini ?? 0}"`,
            `Name="${esc(s.name || seeded?.name || s.id)}"`,
            `Schild="${esc(s.id)}"`,
            `Typ="${esc(typ)}"`,
            `WmAt="${s.wmAt ?? seeded?.wmAt ?? 0}"`,
            `WmPa="${s.wmPa ?? seeded?.wmPa ?? 0}"`,
          ].join(" ")
        )
      );
    }
    push(1, "</SchildWerte>");
  }

  // Nexus extension — Java ignores unknown tags; keep so Kapital round-trips in Nexus.
  if (held.kapital != null && Number.isFinite(held.kapital)) {
    push(1, tag("Kapital", held.kapital));
  }

  lines.push("</Held>");
  return lines.join("\n");
}

export function downloadLegacyHeldXml(held: HeldModel, filename?: string): void {
  const xml = exportLegacyHeldXml(held);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe =
    filename || `${(held.name || "hero").replace(/[^\w\-]+/g, "_")}.dcg`;
  a.download = safe.toLowerCase().endsWith(".dcg")
    ? safe
    : safe.replace(/\.(xml|chargen\.json|json)$/i, "") + ".dcg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

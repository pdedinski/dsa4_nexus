/**
 * Export hero to legacy Java Chargen NanoXML `<Held>` (.dcg) format.
 * Layout mirrors FactoryHeldXmlOut / FactoryHeldXmlIn expectations.
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name: string, value: string | number): string {
  return `<${name}>${esc(String(value))}</${name}>`;
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

function catalogById(category: "melee_weapons" | "ranged_weapons" | "shields", id: string) {
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
    const bonuses = (item.special_ability_bonuses as Array<{
      id?: string;
      variant?: string | null;
      description?: string | null;
      open?: boolean;
      choices?: Array<{ id?: string; variant?: string | null }>;
    }>) || [];
    for (const b of bonuses) {
      if (b.open && b.choices) {
        const hit = b.choices.find(
          (c) => c.id === sfId && (c.variant || "")
        );
        if (hit?.variant) return String(hit.variant);
        continue;
      }
      if (b.id === sfId) {
        const v = b.variant || b.description;
        if (v) return String(v);
      }
    }
    const cheap = (item.discounted_special_ability_variants as Array<{
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

export function exportLegacyHeldXml(held: HeldModel): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<Held>"];

  lines.push(tag("Name", held.name));
  lines.push(tag("Rasse", held.raceId));
  lines.push(tag("Kultur", held.cultureId));
  lines.push(tag("Profession", held.professionId));
  lines.push(
    tag(
      "Geschlecht",
      held.gender === "female" ? "WEIBLICH" : "MAENNLICH"
    )
  );
  lines.push(tag("Geburtstag", held.birthday || "1. Praios, 1 Hal"));
  lines.push(tag("Alter", held.age));
  lines.push(tag("Groesse", held.heightCm));
  lines.push(tag("Gewicht", held.weightKg));
  lines.push(tag("Haarfarbe", held.hairColor));
  lines.push(tag("Augenfarbe", held.eyeColor));
  lines.push(tag("Aussehen", held.appearance));
  lines.push(tag("Stand", held.status));
  lines.push(tag("Titel", held.title));
  lines.push(tag("Hintergrund", held.background));
  lines.push(tag("GesamtAp", held.apTotal || held.apSpent));
  lines.push(tag("EingesetzteAp", held.apSpent));

  lines.push("<EigenschaftWerte>");
  for (const a of held.attributes) {
    const german = ATTR_TO_GERMAN[a.code];
    if (!german) continue;
    lines.push(
      `<EigenschaftWert Eigenschaft="${esc(german)}" Basisstufe="${a.base}" Zukauf="${a.purchased}" SpezielleErfahrung="${a.specialExperience ? "true" : "false"}"/>`
    );
  }
  lines.push("</EigenschaftWerte>");

  lines.push("<BasiswertWerte>");
  for (const d of held.derived) {
    // GS (Speed) is computed by Java Held.getGeschwindigkeit() — not a Basiswert.
    // Emitting Basiswert="Geschwindigkeit" makes FactoryHeldXmlIn throw on re-import.
    if (d.code === "GS") continue;
    const german = DERIVED_TO_GERMAN[d.code as Exclude<typeof d.code, "GS">];
    if (!german) continue;
    lines.push(
      `<BasiswertWert Basiswert="${esc(german)}" Bonus="${d.modification}" Zukauf="${d.purchased}" SpezielleErfahrung="${d.specialExperience ? "true" : "false"}"/>`
    );
  }
  lines.push("</BasiswertWerte>");

  // Muttersprache is required by FactoryHeldXmlIn.ermitteleMuttersprache.
  const motherTongue = resolveMotherTongue(held);
  if (motherTongue) lines.push(tag("Muttersprache", motherTongue));
  if (held.secondLanguage) lines.push(tag("Zweitsprache", held.secondLanguage));

  lines.push("<TalentWerte>");
  for (const t of held.talents) {
    const attrs = [
      `Talent="${esc(t.id)}"`,
      `UnmodifizierteStufe="${t.tp}"`,
      `SpezielleErfahrung="${t.specialExperience ? "true" : "false"}"`,
      t.attack != null ? `Attacke="${t.attack}"` : "",
      t.activated === false ? 'Aktiviert="false"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`<TalentWert ${attrs}/>`);
  }
  lines.push("</TalentWerte>");

  if (held.leadTalents.length) {
    lines.push("<Leittalente>");
    for (const id of held.leadTalents) {
      lines.push(`<Talent>${esc(id)}</Talent>`);
    }
    lines.push("</Leittalente>");
  }

  if (held.spells.length) {
    lines.push("<ZauberWerte>");
    for (const s of held.spells) {
      const attrs = [
        `Zauber="${esc(s.id)}"`,
        `Stufe="${s.sp}"`,
        `SpezielleErfahrung="${s.specialExperience ? "true" : "false"}"`,
        s.variant ? `Variante="${esc(s.variant)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(`<ZauberWert ${attrs}/>`);
    }
    lines.push("</ZauberWerte>");
  }

  if (held.houseSpells.length) {
    lines.push("<Hauszauber>");
    for (const id of held.houseSpells) {
      lines.push(`<Zauber>${esc(id)}</Zauber>`);
    }
    lines.push("</Hauszauber>");
  }
  if (held.leadSpells.length) {
    lines.push("<Leitzauber>");
    for (const id of held.leadSpells) {
      lines.push(`<Zauber>${esc(id)}</Zauber>`);
    }
    lines.push("</Leitzauber>");
  }

  if (held.specialAbilities.length) {
    const sfLines: string[] = [];
    for (const s of held.specialAbilities) {
      if (!s.id) continue;
      // Java getTalentspezialisierung/getScharfschuetze require Talent.
      if (specializationNeedsTalent(s.id) && !s.talent) continue;
      const meta = getBuiltinCatalog("special_abilities").find(
        (c) => c.id === s.id
      ) as SfMeta | undefined;
      const variant = resolveSfVariantForExport(held, s);
      // FactoryHeldXmlIn.erzeugeSonderfertigkeitWert NPEs when hatVarianten && Variante is null.
      if (sfRequiresVariant(meta) && !variant) continue;
      const attrs = [
        `Sonderfertigkeit="${esc(s.id)}"`,
        s.talent ? `Talent="${esc(s.talent)}"` : "",
        variant ? `Variante="${esc(variant)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      sfLines.push(`<SonderfertigkeitWert ${attrs}/>`);
    }
    if (sfLines.length) {
      lines.push("<SonderfertigkeitWerte>");
      lines.push(...sfLines);
      lines.push("</SonderfertigkeitWerte>");
    }
  }

  if (held.discountedSpecialAbilities.length) {
    lines.push("<VerbilligteSonderfertigkeiten>");
    for (const id of held.discountedSpecialAbilities) {
      // Specialization discounts need Talent — omit incomplete rows.
      if (specializationNeedsTalent(id)) continue;
      lines.push(`<Sonderfertigkeit Sonderfertigkeit="${esc(id)}"/>`);
    }
    lines.push("</VerbilligteSonderfertigkeiten>");
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
      const attrs = [
        `Sonderfertigkeit="${esc(v.id)}"`,
        v.talent ? `Talent="${esc(v.talent)}"` : "",
        variant ? `Variante="${esc(variant)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      // Held XML uses SonderfertigkeitWert children (FactoryHeldXmlOut), not baustein <Variante>.
      vvLines.push(`<SonderfertigkeitWert ${attrs}/>`);
    }
    if (vvLines.length) {
      lines.push("<VerbilligteVarianten>");
      lines.push(...vvLines);
      lines.push("</VerbilligteVarianten>");
    }
  }

  if (held.advantagesDisadvantages.length) {
    // Java VorNachteil.hatVarianten() — VariantenFrei empty arrays still return true.
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
          const list = (item[key] as Array<{
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
        // Profession/culture BesondererBesitz lists map to VorNachteil.BesondererBesitz variants.
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
      // FactoryHeldXmlIn.erzeugeVorNachteilWert → new Variante(null) NPE when hatVarianten.
      if (needsFixed && !variant) continue;
      if (needsFree && !variant) variant = "?";
      const attrs = [
        `VorNachteil="${esc(t.id)}"`,
        t.specialExperience ? 'SpezielleErfahrung="true"' : "",
        t.rating != null ? `Stufe="${t.rating}"` : "",
        variant ? `Variante="${esc(variant)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      vnLines.push(`<VorNachteilWert ${attrs}/>`);
    }
    if (vnLines.length) {
      lines.push("<VorNachteilWerte>");
      lines.push(...vnLines);
      lines.push("</VorNachteilWerte>");
    }
  }

  if (held.meleeWeapons.length) {
    lines.push("<NahkampfwaffeWerte>");
    for (const w of held.meleeWeapons) {
      const cat = catalogById("melee_weapons", w.id);
      const seeded = cat ? meleeWertFromCatalog(cat) : undefined;
      const talent = w.talent || seeded?.talent || "";
      const tp = w.tp || seeded?.tp || "1W6";
      const dkH = w.dkH ?? seeded?.dkH ?? false;
      const dkN = w.dkN ?? seeded?.dkN ?? false;
      const dkS = w.dkS ?? seeded?.dkS ?? false;
      lines.push(
        `<NahkampfwaffeWert Nahkampfwaffe="${esc(w.id)}" Name="${esc(w.name || seeded?.name || w.id)}" Talent="${esc(talent)}" Tp="${esc(tp)}" Bf="${w.bf ?? seeded?.bf ?? 0}" Ini="${w.ini ?? seeded?.ini ?? 0}" WmAt="${w.wmAt ?? seeded?.wmAt ?? 0}" WmPa="${w.wmPa ?? seeded?.wmPa ?? 0}" DkH="${dkH ? "true" : "false"}" DkN="${dkN ? "true" : "false"}" DkS="${dkS ? "true" : "false"}" Schadensschritt="${w.damageStep ?? seeded?.damageStep ?? 0}" Schwellenwert="${w.damageThreshold ?? seeded?.damageThreshold ?? 0}"/>`
      );
    }
    lines.push("</NahkampfwaffeWerte>");
  }

  if (held.rangedWeapons.length) {
    lines.push("<FernkampfwaffeWerte>");
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
        talent ? `Talent="${esc(talent)}"` : "",
        `Tp="${esc(tp)}"`,
        `TpPlus="${tpPlus}"`,
        `Reichweiten="${ranges}"`,
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(`<FernkampfwaffeWert ${attrs}/>`);
    }
    lines.push("</FernkampfwaffeWerte>");
  }

  if (held.armors.length) {
    lines.push("<RuestungWerte>");
    for (const a of held.armors) {
      lines.push(
        `<RuestungWert Ruestung="${esc(a.id)}" Name="${esc(a.name || a.id)}" Rs="${a.rs ?? 0}" Be="${a.be ?? 0}"/>`
      );
    }
    lines.push("</RuestungWerte>");
  }

  if (held.shields.length) {
    lines.push("<SchildWerte>");
    for (const s of held.shields) {
      const cat = catalogById("shields", s.id);
      const seeded = cat ? shieldWertFromCatalog(cat) : undefined;
      const typ = s.type || seeded?.type || "SchildTyp.klein";
      lines.push(
        `<SchildWert Schild="${esc(s.id)}" Name="${esc(s.name || seeded?.name || s.id)}" Typ="${esc(typ)}" Ini="${s.ini ?? seeded?.ini ?? 0}" WmAt="${s.wmAt ?? seeded?.wmAt ?? 0}" WmPa="${s.wmPa ?? seeded?.wmPa ?? 0}" Bf="${s.bf ?? seeded?.bf ?? 0}"/>`
      );
    }
    lines.push("</SchildWerte>");
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
    filename ||
    `${(held.name || "hero").replace(/[^\w\-]+/g, "_")}.dcg`;
  a.download = safe.toLowerCase().endsWith(".dcg")
    ? safe
    : safe.replace(/\.(xml|chargen\.json|json)$/i, "") + ".dcg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

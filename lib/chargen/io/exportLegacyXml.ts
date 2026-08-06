/**
 * Export hero to legacy Java Chargen NanoXML `<Held>` (.dcg) format.
 */

import type { HeldModel } from "@/lib/chargen/types";
import {
  ATTR_TO_GERMAN,
  DERIVED_TO_GERMAN,
} from "@/lib/chargen/types";

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
  if (held.motherTongue) lines.push(tag("Muttersprache", held.motherTongue));
  if (held.secondLanguage) lines.push(tag("Zweitsprache", held.secondLanguage));

  lines.push("<EigenschaftWerte>");
  for (const a of held.attributes) {
    const german = ATTR_TO_GERMAN[a.code];
    if (!german) continue;
    lines.push(
      `<EigenschaftWert Eigenschaft="${esc(german)}" Basisstufe="${a.base}" Zukauf="${a.purchased}"${a.specialExperience ? ' SpezielleErfahrung="true"' : ""}/>`
    );
  }
  lines.push("</EigenschaftWerte>");

  lines.push("<BasiswertWerte>");
  for (const d of held.derived) {
    const german = DERIVED_TO_GERMAN[d.code];
    if (!german) continue;
    lines.push(
      `<BasiswertWert Basiswert="${esc(german)}" Bonus="${d.modification}" Zukauf="${d.purchased}"${d.specialExperience ? ' SpezielleErfahrung="true"' : ""}/>`
    );
  }
  lines.push("</BasiswertWerte>");

  lines.push("<TalentWerte>");
  for (const t of held.talents) {
    const attrs = [
      `Talent="${esc(t.id)}"`,
      `UnmodifizierteStufe="${t.tp}"`,
      t.specialExperience ? 'SpezielleErfahrung="true"' : "",
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

  lines.push("<ZauberWerte>");
  for (const s of held.spells) {
    const attrs = [
      `Zauber="${esc(s.id)}"`,
      `Stufe="${s.sp}"`,
      s.variant ? `Variante="${esc(s.variant)}"` : "",
      s.specialExperience ? 'SpezielleErfahrung="true"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`<ZauberWert ${attrs}/>`);
  }
  lines.push("</ZauberWerte>");

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

  lines.push("<SonderfertigkeitWerte>");
  for (const s of held.specialAbilities) {
    const attrs = [
      `Sonderfertigkeit="${esc(s.id)}"`,
      s.talent ? `Talent="${esc(s.talent)}"` : "",
      s.variant ? `Variante="${esc(s.variant)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`<SonderfertigkeitWert ${attrs}/>`);
  }
  lines.push("</SonderfertigkeitWerte>");

  if (held.discountedSpecialAbilities.length) {
    lines.push("<VerbilligteSonderfertigkeiten>");
    for (const id of held.discountedSpecialAbilities) {
      lines.push(`<Sonderfertigkeit Sonderfertigkeit="${esc(id)}"/>`);
    }
    lines.push("</VerbilligteSonderfertigkeiten>");
  }

  lines.push("<VorNachteilWerte>");
  for (const t of held.advantagesDisadvantages) {
    const attrs = [
      `VorNachteil="${esc(t.id)}"`,
      t.rating != null ? `Stufe="${t.rating}"` : "",
      t.variant ? `Variante="${esc(t.variant)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`<VorNachteilWert ${attrs}/>`);
  }
  lines.push("</VorNachteilWerte>");

  lines.push("<NahkampfwaffeWerte>");
  for (const w of held.meleeWeapons) {
    lines.push(
      `<NahkampfwaffeWert Nahkampfwaffe="${esc(w.id)}"${w.name ? ` Name="${esc(w.name)}"` : ""}${w.talent ? ` Talent="${esc(w.talent)}"` : ""}${w.tp ? ` Tp="${esc(w.tp)}"` : ""} Bf="${w.bf ?? 0}" Ini="${w.ini ?? 0}" WmAt="${w.wmAt ?? 0}" WmPa="${w.wmPa ?? 0}" DkH="${w.dkH ? "true" : "false"}" DkN="${w.dkN ? "true" : "false"}" DkS="${w.dkS ? "true" : "false"}" Schadensschritt="${w.damageStep ?? 0}" Schwellenwert="${w.damageThreshold ?? 0}"/>`
    );
  }
  lines.push("</NahkampfwaffeWerte>");

  lines.push("<FernkampfwaffeWerte>");
  for (const w of held.rangedWeapons) {
    lines.push(
      `<FernkampfwaffeWert Fernkampfwaffe="${esc(w.id)}"${w.name ? ` Name="${esc(w.name)}"` : ""}${w.talent ? ` Talent="${esc(w.talent)}"` : ""}${w.tp ? ` Tp="${esc(w.tp)}"` : ""}${w.tpPlus?.length ? ` TpPlus="${w.tpPlus.join(",")}"` : ""}${w.ranges?.length ? ` Reichweiten="${w.ranges.join(",")}"` : ""}/>`
    );
  }
  lines.push("</FernkampfwaffeWerte>");

  lines.push("<RuestungWerte>");
  for (const a of held.armors) {
    lines.push(
      `<RuestungWert Ruestung="${esc(a.id)}"${a.name ? ` Name="${esc(a.name)}"` : ""} Rs="${a.rs ?? 0}" Be="${a.be ?? 0}"/>`
    );
  }
  lines.push("</RuestungWerte>");

  lines.push("<SchildWerte>");
  for (const s of held.shields) {
    lines.push(
      `<SchildWert Schild="${esc(s.id)}"${s.name ? ` Name="${esc(s.name)}"` : ""}${s.type ? ` Typ="${esc(s.type)}"` : ""} Ini="${s.ini ?? 0}" WmAt="${s.wmAt ?? 0}" WmPa="${s.wmPa ?? 0}" Bf="${s.bf ?? 0}"/>`
    );
  }
  lines.push("</SchildWerte>");

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

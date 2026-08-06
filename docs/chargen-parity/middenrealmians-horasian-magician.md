# Chargen parity audit: Middenrealmians / Horasian Empire / Magician

**Date:** 2026-08-06 (updated: Ancient Language Fest + veteran +2000 AP)  
**Build:** Middenrealmians / Horasian Empire / Magician  
**Method:** Identical scripted purchases on both systems (creation + veteran).  
**Ground truth:** Real bytecode via `D:\Work\TDE\Chargen\chargen.jar` (`HeadlessSimMagier`) vs port rules in `lib/chargen/`.  
**Names:** English labels from the port catalogs (`name` fields); German data IDs only where needed for code references.

Raw ledgers:

- [java-ledger-middenrealmian-magician.txt](./java-ledger-middenrealmian-magician.txt)
- [port-ledger-middenrealmian-magician.txt](./port-ledger-middenrealmian-magician.txt)

Harnesses:

- Java: `D:\Work\TDE\Chargen\de\bernhardjung\dsaprogramm\erschaffung\HeadlessSimMagier.java`
- Port: [`scripts/sim/middenrealmian-magician.ts`](../../scripts/sim/middenrealmian-magician.ts)

This build deliberately spends on **different** talents / spells / abilities than the Legend Singer audit (Ritual Lore, Arcane Lore, Alchemy, house combat/utility spells, Fourth Wand Enchantment, Treat Soul / Ride / Seduce).

---

## Verdict

**All GP/AP purchase costs match exactly** (32 nonzero purchase events). Seed state now also matches for Ancient Language (Bosparano +6 / Proto-Tulamidyan +4).

| Checkpoint | Both |
|------------|------|
| Bosparano / Proto-Tulamidyan at seed | **6** / **4** |
| Creation AP left | **3** |
| Fourth Wand Enchantment | **75** |
| Veteran add | **2000** AP |
| Ritual Lore after veteran | **25** |
| Arcane Lore after veteran | **12** |
| Veteran AP left | **1** |

---

## Fix applied: Ancient Language Fest

Java Magician package includes `<AlteSpracheBosparanoUrTulamidya>` (auto Bosparano/Proto-Tulamidyan by mother tongue). The port previously skipped this Fest.

1. **Extract** ([`scripts/chargen-extract/extract-all.mjs`](../../scripts/chargen-extract/extract-all.mjs)): emit `type: "ancient_language"` with `bonuses: [6, 4]` from `AlteSpracheBosparanoUrTulamidya`.
2. **Apply** ([`lib/chargen/rules/applyBausteine.ts`](../../lib/chargen/rules/applyBausteine.ts)): `applyAncientLanguageBonuses()` — Garethi mother → Bosparano higher + Proto-Tulamidyan lower; Tulamidyan mother → reversed (mirrors `TalentbonusFestAlteSprache`).
3. Regenerated profession JSON via `--bausteine-only`.

---

## Matching purchase ledger (summary)

| Phase | Step | Cost | Both |
|-------|------|------|------|
| GP | Arrogance 5 | −5 | match |
| GP | Good Memory | 12 | match |
| GP | Inner Clock | 3 | match |
| Creation | Ritual Lore 3→11 | 21…70 | match |
| Creation | Fourth Wand Enchantment (½) | **75** | match |
| Creation | Alertness (½) | skip (need 100, have 43) | match |
| Creation | Arcane Lore 6→8 | 17, 19 | match |
| Creation | Language Lore 1→2 | 4 | match |
| Creation AP left | — | **3** | match |
| Veteran | +2000 AP | credit 2003 | match |
| Veteran | Treat Soul / Ride activate | 10 / 20 | match |
| Veteran | Ritual Lore 11→25 | 80…190 | match |
| Veteran | Arcane Lore 8→12 | 22…32 | match |
| Veteran AP left | — | **1** | match |

---

## Remaining non-cost nuance

| Item | Java | Port | Notes |
|------|------|------|-------|
| Garethi displayed TP | **13** (`getStufe` includes mother-tongue CL−2) | **2** stored (CL−2 via display helper) | Same pattern as Isdira on the Legend Singer build |
| Lead talents / lead spells | 0 / none | 0 / none | Guild Magician package has no lead-spell picks |

---

## Canonical inputs (English catalog names)

| Choice | English | Catalog ID |
|--------|---------|------------|
| Race / culture / profession | Middenrealmians / Horasian Empire / Magician | `Rasse.Mittellaender` / `Kultur.Horasreich` / `Profession.Magier` |
| Package GP | Race 0 + culture 3 + profession 18 = **21** | — |
| Attribute bases | CO 11, CL 13, IN 11, CH 12, DE 8, AG 8, CN 8, ST 8, SO 7 | Profession mins + SO floor |
| AP start | **480** (= 20×(13+11)) | — |
| Culture language pick +5 | Tulamidyan | `Talent.Tulamidya` |
| Mother tongue / non-mother / script | Garethi +2 / Tulamidyan +4 / Kuslik Signs +7 | auto in Java; open picks in port |
| Ancient Language (auto) | Bosparano +6, Proto-Tulamidyan +4 | `AlteSpracheBosparanoUrTulamidya` |
| Extra script pick +4 | Proto-Tulamidyan (Script) | `Talent.UrTulamidyaSchrift` |
| Optional GP | Arrogance 5 → Good Memory → Inner Clock | `VorNachteil.Arroganz` / `GutesGedaechtnis` / `Zeitgefuehl` |
| Discounted SF bought | Fourth Wand Enchantment (150→75) | `Sonderfertigkeit.Kraftfokus` |
| Discounted SF skipped | Alertness (200→100; unaffordable after Kraftfokus) | `Sonderfertigkeit.Aufmerksamkeit` |
| Creation raise priority | Ritual Lore, Arcane Lore, Alchemy, Language Lore, Starcraft, Plant Lore, History, Etiquette, Fast-Talk | — |
| Spell raise priority | Analytica Arcana, Thunderbolt, Paralyze, Silence Reigns Supreme, Breath of Magic, Deep Sleep | (not reached — talent priority consumed AP) |
| Veteran | **+2000 AP**; activate Treat Soul + Ride; raise talents/spells | — |

---

## How to re-run

```bat
:: Port
cd D:\Work\TDE\DSA_Nexus
npx tsx scripts/sim/middenrealmian-magician.ts

:: Java (from D:\Work\TDE\Chargen; uses extracted/ classpath)
javac -encoding UTF-8 -cp "extracted;lib\*" -d . de\bernhardjung\dsaprogramm\erschaffung\HeadlessSimMagier.java
java -cp ".;extracted;lib\*" de.bernhardjung.dsaprogramm.erschaffung.HeadlessSimMagier
```

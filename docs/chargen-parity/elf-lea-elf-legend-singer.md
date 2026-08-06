# Chargen parity audit: Elves / Lea Elf / Legend Singer

**Date:** 2026-08-06 (updated after lead-talent fix)  
**Build:** Elves / Lea Elf / Legend Singer  
**Method:** Identical scripted purchases on both systems (creation + veteran).  
**Ground truth:** Real bytecode via `D:\Work\TDE\Chargen\chargen.jar` (HeadlessSim) vs real port rules in `lib/chargen/`.  
**Names:** English labels from the port catalogs (`name` fields); German data IDs only where needed for code references.

Raw ledgers:

- [java-ledger-elf-legend-singer.txt](./java-ledger-elf-legend-singer.txt)
- [port-ledger-elf-legend-singer.txt](./port-ledger-elf-legend-singer.txt)

Harnesses:

- Java: `D:\Work\TDE\Chargen\de\bernhardjung\dsaprogramm\erschaffung\HeadlessSim.java`
- Port: [`scripts/sim/elf-legend-singer.ts`](../../scripts/sim/elf-legend-singer.ts)

---

## Verdict (after lead-talent fix)

**All GP/AP purchase costs in this scripted build now match exactly** between Java and the port — including Legend Lore raises under Elven Worldview, Magical Melody, Etiquette/Ride activation, and final AP remaining.

Lead talents: **27** on both sides.

### Latest re-run (veteran +1000 AP → talents/spells only)

Veteran phase adds **1000 AP** and spends it on talent activations/raises and spells (no attribute purchase). Ledgers still match line-for-line (`MISMATCHES=0`):

| Veteran step | Cost | Both |
|--------------|------|------|
| Etiquette activate | 15 | match |
| Ride activate | 25 | match |
| Legend Lore 18→30 | 55…95 each | match |
| Sing 9→10 | 50 | match |
| Persuade 5→6 | 14 | match |
| AP remaining | **2** | match |
| Final Legend Lore | **30** | match |

(Spells were not raised: the talent priority list consumed the pool first.)

---

## Fix applied

1. **Extract** ([`scripts/chargen-extract/extract-all.mjs`](../../scripts/chargen-extract/extract-all.mjs)): emit `lead_talents` from `<Leittalente>` and `lead: true` on Fest with `Leittalent="true"`.
2. **Apply** ([`lib/chargen/rules/applyBausteine.ts`](../../lib/chargen/rules/applyBausteine.ts)): `computeLeadTalents()` unions race/culture/profession lists + Fest lead flags (including open picks like Bowyer); returned on `held.leadTalents` from `applyFixedBausteine` / `reapplyOpenTalentBonuses`.
3. Regenerated race/culture/profession JSON via `--bausteine-only`.

---

## Matching purchase ledger (excerpt)

| Step | Java | Port |
|------|------|------|
| Legend Lore 8→9 | **22** | **22** |
| Legend Lore 9→10 … 17→18 | 25…51 | identical |
| Persuade 3→4, 4→5 | 8, 11 | identical |
| Creation AP remaining | **1** | **1** |
| Veteran start credit | **1** | **1** |
| Etiquette / Ride activate | 15 / 25 | identical |
| Legend Lore 18→30 (veteran, +1000 AP) | 55…95 | identical |
| Sing 9→10 | 50 | 50 |
| Persuade 5→6 | 14 | 14 |
| Veteran final credit | **2** | **2** |
| Final Legend Lore TP | **30** | **30** |
| Lead talent count | **27** | **27** |

Full raise/buy line lists are identical.

---

## Remaining non-cost nuance (not exercised as a purchase delta here)

| Item | Java | Port | Notes |
|------|------|------|-------|
| Isdira displayed TP after seed | **12** (includes mother-tongue CL−2) | **4** stored (CL−2 via display helper) | Both mark lead. Raises would use different SKT rows if Isdira were raised — not hit in this priority spend. |
| Lead spells auto-mark | House + picks (+ package leads) | All package spells auto-lead under Elven Worldview | Broader on port; spell raises not exercised in this spend path. |
| Educated (Gebildet) finish accounting | Adds to total + spent AP | Display via educated AP applied | N/A — build has no Educated. |

---

## Canonical inputs (English catalog names)

| Choice | English | Catalog ID |
|--------|---------|------------|
| Race / culture / profession | Elves / Lea Elf / Legend Singer | `Rasse.Elfen` / `Kultur.Auelfen` / `Profession.Legendensaenger` |
| Sense advantage | Outstanding Hearing | `VorNachteil.HerausragendesGehoer` |
| Culture craft pick | Bowyer +2 | `Talent.Bogenbau` |
| Culture foreign languages +4 | Tulamidyan | `Talent.Tulamidya` |
| Profession craft pick | Voice Mimicry +2 | `Talent.StimmenImitieren` |
| Profession foreign languages +6 | Garethi | `Talent.Garethi` |
| Profession script | Isdira (Script) +9 | `Talent.IsdiraSchrift` |
| Lead spells (3) | Attributio, Balm of Healing, Light in the Darkness | `Zauber.Attributo` / `BalsamSalabunde` / `FlimFlamFunkel` |
| Attribute bases | CO 8, CL 11, IN 12, CH 13, DE 8, AG 8, CN 8, ST 8, SO 3 | — |
| Optional advantage | Astral Power 6 (Good Memory skipped — 12 GP, only 6 left) | `VorNachteil.Astralmacht` / `GutesGedaechtnis` |
| Discounted special ability | Magical Melody (½ price) | `Sonderfertigkeit.Zaubermelodie` |
| Creation raise priority | Legend Lore, Sing, Persuade, Play Instrument, Human Nature, Dance, Tulamidyan, Isdira, Teach, History | — |
| Spell raise priority | Balm of Healing, Be My Friend, See True and Pure | — |
| Veteran | +1000 AP; activate Etiquette + Ride; raise talents/spells | — |

---

## How to re-run

```bat
:: Port
cd D:\Work\TDE\DSA_Nexus
npx tsx scripts/sim/elf-legend-singer.ts

:: Java (from D:\Work\TDE\Chargen; uses extracted/ classpath)
java -cp ".;extracted;lib\*" de.bernhardjung.dsaprogramm.erschaffung.HeadlessSim
```

# Baustein extract audit: special TalentBoni / SF tags

**Date:** 2026-08-06  
**Scope:** All `*.ras` / `*.kul` / `*.pro` under Java Chargen data vs port extract (`scripts/chargen-extract/extract-all.mjs`).  
**Method:** Inventory immediate children of `TalentBoni`, `SonderfertigkeitBoni`, `VerbilligteSonderfertigkeiten`, `VerbilligteVarianten`, etc., against Java factory parsers.

## TalentBoni (Java `FactoryTalentBoniIn`)

| Tag | Occurrences | Status |
|-----|-------------|--------|
| `Fest` | 715 / 31 files | Handled |
| `Frei` | 1 (`Kultur.AndergastNostria`) | **Fixed** — was reading child `Bonus` (always 0); now uses `@_Bonus` → points **4** |
| `AlteSpracheBosparanoUrTulamidya` | 1 (`Profession.Magier`) | **Fixed** earlier + apply by mother tongue |

No other TalentBoni child tags exist in the data set.

## SonderfertigkeitBoni

| Tag | Files | Status |
|-----|-------|--------|
| `Werte` (1 option) | Magician, etc. | Auto-apply — handled |
| `Werte` (multi `Wert`) | Hunter Sharpshooter talent pick, etc. | **Fixed** — now `open: true` + `choices` (with `@_Talent`) |
| `Gelaendekunde` | Hunter, Scout, Wilderness Runner | **Fixed** — open topography pick (10 terrain SFs) |

## VerbilligteSonderfertigkeiten / Varianten

| Tag | Files | Status |
|-----|-------|--------|
| `Sonderfertigkeit` | many | Handled |
| `Gelaendekunde` | Courier | **Fixed** — open discounted terrain pick |
| `VerbilligteVarianten` | Courier, Explorer, Scout | **Extracted** as `discounted_special_ability_variants` — cost/UI apply for variant discounts still incomplete (held only stores id-level discounts today) |

## Other (already OK or out of TalentBoni)

| Item | Status |
|------|--------|
| `Zweitsprachen` | Extracted → `second_languages` |
| `KostenRasse` | Extracted → `gp_cost_by_race` (Magician / Half Elves) |
| `Fest Typ="Entdecker"` | **Extracted** as `typ: "Entdecker"` — SKT/cost behavior for Explorer column not yet mirrored in raise rules |
| `Leittalente` / spells / mods | Handled |
| `Zwergin` / `Geschlecht` prerequisites | Not extracted as structured prereqs (UI gating only for now) |

## Apply-side notes

- `applySpecialBonuses` skips `open: true` entries (Java queues them as offene Boni).
- Open SF picks still need UI/`openSpecialPicks` (same pattern as talent open picks).
- Magician parity sim still green after regenerate (Ancient Language + fixed SFs).

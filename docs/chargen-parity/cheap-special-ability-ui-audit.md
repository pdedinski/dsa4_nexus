# Cheap / open special-ability UI audit

**Date:** 2026-08-06  
**Issue:** Port showed “Cheap special ability choice” when a culture/profession listed **multiple fixed** discounted SFs. Java applies **all** of those; a real picker exists only for open packs (`<Gelaendekunde/>`).

## False pickers (fixed discounts — all granted in Java)

| Package | Fixed discounted SFs (English) |
|---------|--------------------------------|
| Lea Elf / Lea Elf (Half-Elves) | Alertness, Underwater Combat, Regeneration I |
| Fountland | Topography: Swamp, Topography: Ice |
| Thorwal | Hammer Fist, Topography: Sea |
| Legend Singer | Song of Sorrow, Song of Peace, Whispering Wind, Magical Melody |
| Magician | Alertness, Regeneration II, Third Wand Enchantment, Fourth Wand Enchantment |
| Ranger | Dodge I, Dodge II |

## Legitimate open cheap pick (kept)

| Package | Why |
|---------|-----|
| Messenger (`Profession.Botenreiter`) | `<Gelaendekunde/>` — choose one topography SF at discount (+ fixed Mounted Combat on horse) |

## Legitimate open *granted* SF picks (not “cheap”)

| Package | Choice |
|---------|--------|
| Middenrealm Cities | Area Knowledge (auto) + **Culture Lore** among 4 region variants |
| Hunter | Sharpshooter (Crossbow / Bow / Throwing Spears) + topography |
| Scout / Ranger | topography grant |

## Fix

Removed the heuristic `list.length > 1 && all fixed → pick one` from `listOpenCheapSpecialChoices`. Only entries with `open: true` and `choices` (e.g. terrain knowledge) surface the UI.

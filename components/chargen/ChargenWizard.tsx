"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { ChargenCatalogCategory, HeldModel, LearningMethod } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  emptyHeld,
  isVeteranPhase,
} from "@/lib/chargen/types";
import { computeBudget, applyCreationAttributeMinimums, resolveProfessionGpCost } from "@/lib/chargen/rules/budget";
import {
  computeMagicApSpent,
  educatedApApplied,
  educatedApSavings,
  specialAbilityGpSpent,
} from "@/lib/chargen/rules/budgetExtras";
import { buildAttributeMods } from "@/lib/chargen/rules/attributeMods";
import { collectProblems } from "@/lib/chargen/rules/problems";
import { recomputeDerived } from "@/lib/chargen/rules/derived";
import {
  addOrRaiseSpell,
  lowerOrRemoveSpell,
  spellDisplayApCost,
} from "@/lib/chargen/rules/spellActivation";
import { finishCreation, learnSpecialAbilityVeteran, veteranSpecialAbilityCost } from "@/lib/chargen/rules/veteran";
import {
  applyFixedBausteine,
  connectionPointsGranted,
  effectiveTalentTp,
  leadSpellPickCount,
  listOpenCheapSpecialChoices,
  listOpenSpecialAbilityBonuses,
  listOpenTalentBonuses,
  listOpenTraitBonuses,
  packageAutoLeadSpellIds,
  professionSpecialItems,
  resolveOpenTalentChoiceOptions,
  seededTalentIds,
  seededTalentMinimums,
  traitGpNet,
  unsuitableTraitIds,
} from "@/lib/chargen/rules/applyBausteine";
import { isSpellSelectable, spellBlockReason, spellcasterBlocked } from "@/lib/chargen/rules/spellPrereqs";
import {
  loadChargenSettings,
  saveChargenSettings,
  type ChargenFinishMode,
} from "@/lib/chargen/settings";
import {
  blocksCreationChoice,
  formatPrerequisites,
} from "@/lib/chargen/rules/prerequisiteLabels";
import {
  isSpecialAbilitySelectable,
} from "@/lib/chargen/rules/checkSpecialAbilityPrereqs";
import {
  expandSpecialAbilities,
  formatSpecialAbilityLabel,
  groupExpandedSpecialAbilities,
  findOwnedForInstance,
  specializationApCost,
  specialAbilityGpCost,
  specializationIndex,
} from "@/lib/chargen/rules/expandSpecialAbilities";
import { formatTraitMeta } from "@/lib/chargen/rules/traitLabels";
import variantLabels from "@/lib/chargen/data/variant_labels.json";
import {
  generateName,
  listNameFactories,
  resolveNameFactoryId,
  rollAge,
  rollAllAppearance,
  rollEyeColor,
  rollHairColor,
  rollHeight,
  rollWeight,
} from "@/lib/chargen/rules/randomizeHero";
import GpApBar from "@/components/chargen/GpApBar";
import ChargenSettingsDialog from "@/components/chargen/ChargenSettingsDialog";
import ProblemsPanel from "@/components/chargen/ProblemsPanel";
import ImportChargenDialog from "@/components/chargen/ImportChargenDialog";
import LoadChargenFromDb from "@/components/chargen/LoadChargenFromDb";
import ChargenSheetView from "@/components/chargen/ChargenSheetView";
import { importHeldJson } from "@/lib/chargen/io/importJson";
import { useSearchParams } from "next/navigation";
import TalentsStepTable from "@/components/chargen/TalentsStepTable";
import OpenTalentBonusGrid from "@/components/chargen/OpenTalentBonusGrid";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";
import VeteranApBar from "@/components/chargen/VeteranApBar";
import VeteranApPanel from "@/components/chargen/VeteranApPanel";
import BaseValuesStepPanel from "@/components/chargen/BaseValuesStepPanel";
import VeteranAttributesPanel from "@/components/chargen/VeteranAttributesPanel";
import VeteranTraitsPanel from "@/components/chargen/VeteranTraitsPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useUnsavedChanges } from "@/components/layout/UnsavedChangesContext";
import { isTalentListMarker } from "@/lib/chargen/rules/talentListMarkers";
import {
  assignOpenPick,
  availableForRank,
  defaultOpenPicks,
  normalizeOpenPicks,
} from "@/lib/chargen/rules/openTalentPicks";

type StepId =
  | "start"
  | "race"
  | "culture"
  | "profession"
  | "bonuses"
  | "hero"
  | "attributes"
  | "talents"
  | "special"
  | "traits"
  | "spells"
  | "equipment"
  | "problems"
  | "finish"
  | "ap"
  | "baseValues"
  | "sheet";

const CREATION_STEPS: { id: StepId; label: string }[] = [
  { id: "start", label: "Start" },
  { id: "race", label: "Race" },
  { id: "culture", label: "Culture" },
  { id: "profession", label: "Profession" },
  { id: "bonuses", label: "Bonuses" },
  { id: "hero", label: "Hero data" },
  { id: "attributes", label: "Attributes" },
  { id: "talents", label: "Talents" },
  { id: "special", label: "Special abilities" },
  { id: "traits", label: "Advantages" },
  { id: "spells", label: "Spells" },
  { id: "equipment", label: "Equipment" },
  { id: "problems", label: "Problems" },
  { id: "finish", label: "Finished" },
];

/** Java PanelRasKulProf — only these exist until Weiter locks the foundation. */
const FOUNDATION_STEP_IDS: StepId[] = ["race", "culture", "profession"];

const VETERAN_STEPS: { id: StepId; label: string }[] = [
  { id: "hero", label: "Hero data" },
  { id: "ap", label: "Adventure Points" },
  { id: "attributes", label: "Attributes" },
  { id: "baseValues", label: "Base values" },
  { id: "talents", label: "Talents" },
  { id: "spells", label: "Spells" },
  { id: "special", label: "Special abilities" },
  { id: "traits", label: "Disadvantages" },
  { id: "equipment", label: "Equipment" },
  { id: "sheet", label: "Sheet / Export" },
];

function CustomBadge({ source }: { source?: string }) {
  if (source !== "custom") return null;
  return (
    <span className="ml-1 inline-block rounded bg-brand/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand">
      Custom
    </span>
  );
}

/** Display order and labels for talent groups (DSA / Java Chargen Talentgruppe). */
const TALENT_GROUP_ORDER: { id: string; label: string }[] = [
  { id: "combat", label: "Combat" },
  { id: "nahkampf", label: "Melee combat" },
  { id: "fernkampf", label: "Ranged combat" },
  { id: "physical", label: "Physical" },
  { id: "social", label: "Social" },
  { id: "nature", label: "Nature" },
  { id: "knowledge", label: "Knowledge" },
  { id: "languages", label: "Languages" },
  { id: "scripts", label: "Scripts" },
  { id: "craft", label: "Craft" },
  { id: "gifts", label: "Gifts" },
  { id: "ritual_knowledge", label: "Ritual Lore" },
];

function talentGroupLabel(group: string): string {
  return (
    TALENT_GROUP_ORDER.find((g) => g.id === group)?.label ||
    group.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function ChargenWizard() {
  const searchParams = useSearchParams();
  const { setBlocked } = useUnsavedChanges();
  const [held, setHeld] = useState<HeldModel>(() => emptyHeld());
  const [step, setStep] = useState<StepId>("start");
  const [catalogs, setCatalogs] = useState<
    Partial<Record<ChargenCatalogCategory, CatalogItem[]>>
  >({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbHeroId, setDbHeroId] = useState<string | null>(null);
  const [, setDbHeroCreatedBy] = useState<string | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [modificationActive, setModificationActive] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [bonusLang, setBonusLang] = useState("");
  const [openAssignments, setOpenAssignments] = useState<
    Record<string, string[]>
  >({});
  const [bausteineKey, setBausteineKey] = useState("");
  const [nameFactoryId, setNameFactoryId] = useState("");
  /** Draft variant / free-text per SA instance key (Java combo before check). */
  const [saVariants, setSaVariants] = useState<Record<string, string>>({});
  const [saCustomVariant, setSaCustomVariant] = useState<
    Record<string, string>
  >({});
  const [saPayment, setSaPayment] = useState<
    Record<string, "ap" | "gp">
  >({});
  const [openTraitPicks, setOpenTraitPicks] = useState<Record<string, string>>(
    {}
  );
  const [openSpecialPicks, setOpenSpecialPicks] = useState<
    Record<string, string>
  >({});
  const [openCheapSpecialPick, setOpenCheapSpecialPick] = useState("");
  const [leadSpellPicks, setLeadSpellPicks] = useState<string[]>([]);
  const [connectionLevels, setConnectionLevels] = useState<
    Record<string, number>
  >({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishMode, setFinishMode] = useState<ChargenFinishMode>("strict");
  const [talentLearningMethod, setTalentLearningMethod] =
    useState<LearningMethod>("none");
  const [attributeLearningMethod, setAttributeLearningMethod] =
    useState<LearningMethod>("none");
  const [spellLearningMethod, setSpellLearningMethod] =
    useState<LearningMethod>("none");
  const [sfLearningMethod, setSfLearningMethod] =
    useState<LearningMethod>("teacher");
  const [traitLearningMethod, setTraitLearningMethod] =
    useState<LearningMethod>("teacher");
  /** After Race+Culture+Profession confirmed (Java Weiter from PanelRasKulProf). */
  const [foundationLocked, setFoundationLocked] = useState(false);

  const veteran = isVeteranPhase(held);
  const foundationComplete = Boolean(
    held.raceId && held.cultureId && held.professionId
  );
  const activeSteps = useMemo(() => {
    if (veteran) return VETERAN_STEPS;
    if (!foundationLocked) {
      return CREATION_STEPS.filter((s) =>
        FOUNDATION_STEP_IDS.includes(s.id)
      );
    }
    return CREATION_STEPS.filter(
      (s) => s.id !== "start" && !FOUNDATION_STEP_IDS.includes(s.id)
    );
  }, [veteran, foundationLocked]);

  useEffect(() => {
    setFinishMode(loadChargenSettings().finishMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chargen/catalog");
        const data = (await res.json()) as {
          catalogs?: Record<ChargenCatalogCategory, CatalogItem[]>;
          warnings?: string[];
        };
        if (cancelled) return;
        setCatalogs(data.catalogs ?? {});
        setWarnings(data.warnings ?? []);
      } catch {
        if (!cancelled) {
          setWarnings(["Could not load catalogs from server."]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const races = catalogs.races ?? [];
  const cultures = catalogs.cultures ?? [];
  const professions = catalogs.professions ?? [];
  const talents = catalogs.talents ?? [];
  const spells = catalogs.spells ?? [];
  const traits = catalogs.advantages_disadvantages ?? [];
  const specials = catalogs.special_abilities ?? [];
  const melee = catalogs.melee_weapons ?? [];
  const ranged = catalogs.ranged_weapons ?? [];
  const armors = catalogs.armor ?? [];
  const shields = catalogs.shields ?? [];

  const race = races.find((r) => r.id === held.raceId);
  const culture = cultures.find((c) => c.id === held.cultureId);
  const profession = professions.find((p) => p.id === held.professionId);

  const filteredCultures = useMemo(() => {
    if (!race?.allowed_cultures) return cultures;
    const allowed = race.allowed_cultures as string[];
    return cultures.filter((c) => allowed.includes(c.id));
  }, [race, cultures]);

  const filteredProfessions = useMemo(() => {
    if (!culture?.professions) return professions;
    const p = culture.professions as {
      mode?: string;
      exclude?: string[];
      include?: string[];
    };
    if (p.mode === "all_except") {
      return professions.filter((x) => !p.exclude?.includes(x.id));
    }
    if ((p.mode === "list" || p.mode === "none_except") && p.include?.length) {
      return professions.filter((x) => p.include!.includes(x.id));
    }
    return professions;
  }, [culture, professions]);

  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const list of [
      races,
      cultures,
      professions,
      talents,
      spells,
      traits,
      specials,
      melee,
      ranged,
      armors,
      shields,
      variantLabels as Array<{ id: string; name?: string }>,
    ]) {
      for (const item of list) {
        m[item.id] = (item.name as string) || item.id;
      }
    }
    return m;
  }, [
    races,
    cultures,
    professions,
    talents,
    spells,
    traits,
    specials,
    melee,
    ranged,
    armors,
    shields,
  ]);

  const expandedSpecials = useMemo(
    () => expandSpecialAbilities(specials, talents, armors),
    [specials, talents, armors]
  );

  const specialGroups = useMemo(
    () => groupExpandedSpecialAbilities(expandedSpecials),
    [expandedSpecials]
  );

  const attributeMods = useMemo(
    () => buildAttributeMods(race, culture, profession),
    [race, culture, profession]
  );

  const refreshDerived = useCallback((h: HeldModel) => {
    const next = { ...h, attributes: [...h.attributes], derived: [...h.derived] };
    recomputeDerived(next, {
      attributeMods,
      race: (race?.derived_modifiers as Record<string, number>) || {},
      culture: (culture?.derived_modifiers as Record<string, number>) || {},
      profession: (profession?.derived_modifiers as Record<string, number>) || {},
    });
    return next;
  }, [race, culture, profession, attributeMods]);

  const applyDbHero = useCallback(
    (payload: { id: string; data: unknown; createdBy: string | null }) => {
      const h = importHeldJson(JSON.stringify(payload.data));
      setHeld(refreshDerived(h));
      setDbHeroId(payload.id);
      setDbHeroCreatedBy(payload.createdBy);
      setFoundationLocked(true);
      setModificationActive(true);
      setStep("ap");
    },
    [refreshDerived]
  );

  const beginModification = useCallback(() => {
    setModificationActive(true);
  }, []);

  const performReset = useCallback(() => {
    setHeld(emptyHeld());
    setBonusLang("");
    setOpenAssignments({});
    setBausteineKey("");
    setNameFactoryId("");
    setSaVariants({});
    setSaCustomVariant({});
    setSaPayment({});
    setOpenTraitPicks({});
    setOpenSpecialPicks({});
    setOpenCheapSpecialPick("");
    setLeadSpellPicks([]);
    setConnectionLevels({});
    setTalentLearningMethod("none");
    setAttributeLearningMethod("none");
    setSpellLearningMethod("none");
    setSfLearningMethod("teacher");
    setTraitLearningMethod("teacher");
    setFoundationLocked(false);
    setDbHeroId(null);
    setDbHeroCreatedBy(null);
    setModificationActive(false);
    setResetConfirmOpen(false);
    setStep("start");
  }, []);

  useEffect(() => {
    setBlocked(modificationActive);
    return () => setBlocked(false);
  }, [modificationActive, setBlocked]);

  useEffect(() => {
    if (loading || deepLinkHandled) return;
    const heroId = searchParams.get("heroId");
    if (!heroId) {
      setDeepLinkHandled(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/chargen/heroes/${heroId}`);
        const data = (await res.json()) as {
          id?: string;
          data?: unknown;
          createdBy?: string | null;
        };
        if (cancelled || !res.ok || !data.id || !data.data) {
          return;
        }
        applyDbHero({
          id: data.id,
          data: data.data,
          createdBy: data.createdBy ?? null,
        });
      } finally {
        if (!cancelled) setDeepLinkHandled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, deepLinkHandled, searchParams, applyDbHero]);

  const openTalentChoices = useMemo(
    () => listOpenTalentBonuses(race, culture, profession),
    [race, culture, profession]
  );

  const openTraitChoices = useMemo(
    () => listOpenTraitBonuses(race, culture, profession),
    [race, culture, profession]
  );

  const openSpecialChoices = useMemo(
    () => listOpenSpecialAbilityBonuses(race, culture, profession),
    [race, culture, profession]
  );

  const openCheapSpecialChoices = useMemo(
    () => listOpenCheapSpecialChoices(race, culture, profession),
    [race, culture, profession]
  );

  const extraLeadSpellCount = useMemo(
    () => leadSpellPickCount(culture),
    [culture]
  );

  const autoLeadSpellIds = useMemo(
    () =>
      packageAutoLeadSpellIds(
        culture,
        profession,
        held.advantagesDisadvantages
      ),
    [culture, profession, held.advantagesDisadvantages]
  );

  const leadSpellCandidates = useMemo(() => {
    const auto = new Set(autoLeadSpellIds);
    return spells
      .filter((s) => !auto.has(String(s.id)))
      .slice()
      .sort((a, b) =>
        String(a.name || a.id).localeCompare(String(b.name || b.id))
      );
  }, [spells, autoLeadSpellIds]);

  const connectionPoints = useMemo(
    () => connectionPointsGranted(profession),
    [profession]
  );

  const specialItemOptions = useMemo(
    () => professionSpecialItems(profession),
    [profession]
  );

  const seedTalentIdSet = useMemo(
    () =>
      seededTalentIds(race, culture, profession, {
        secondLanguage: bonusLang,
        openAssignments,
      }),
    [race, culture, profession, bonusLang, openAssignments]
  );

  const seededTpMap = useMemo(
    () =>
      seededTalentMinimums(race, culture, profession, {
        secondLanguage: bonusLang,
        openAssignments,
      }),
    [race, culture, profession, bonusLang, openAssignments]
  );

  const unsuitableTraits = useMemo(
    () => unsuitableTraitIds(race, culture, profession),
    [race, culture, profession]
  );

  const secondLanguageOptions = useMemo(() => {
    const ids = (culture?.second_languages as string[]) || [];
    if (!ids.length) return [];
    return ids.map((id) => {
      const t = talents.find((x) => x.id === id);
      return { id, name: (t?.name as string) || labelMap[id] || id };
    });
  }, [culture, talents, labelMap]);

  const nameFactories = useMemo(() => listNameFactories(), []);
  const activeNameFactoryId =
    nameFactoryId || resolveNameFactoryId(culture) || "";

  // Prefer culture's name factory when culture changes
  useEffect(() => {
    const fromCulture = resolveNameFactoryId(culture);
    if (fromCulture) setNameFactoryId(fromCulture);
  }, [culture?.id]);

  const talentsByGroup = useMemo(() => {
    const order = TALENT_GROUP_ORDER.map((g) => g.id);
    const buckets = new Map<string, CatalogItem[]>();
    for (const t of talents) {
      const g = String(t.group || "other");
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(t);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) =>
        String(a.name || a.id).localeCompare(String(b.name || b.id))
      );
    }
    const known = order
      .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
      .map((id) => ({ id, items: buckets.get(id)! }));
    const extras = [...buckets.keys()]
      .filter((id) => !order.includes(id))
      .sort()
      .map((id) => ({ id, items: buckets.get(id)! }));
    return [...known, ...extras];
  }, [talents]);

  const professionGp = resolveProfessionGpCost(profession, held.raceId || race?.id);
  const budget = computeBudget(held, {
    raceGp: Number(race?.gp_cost ?? 0),
    cultureGp: Number(culture?.gp_cost ?? 0),
    professionGp,
    traitGpNet: traitGpNet(held, traits, talents),
    specialAbilityGp: specialAbilityGpSpent(held, expandedSpecials),
    attributeMods,
    educatedApSaved: educatedApSavings(held),
    educatedApApplied: educatedApApplied(
      held,
      talents,
      expandedSpecials,
      spells,
      seedTalentIdSet
    ),
    magicApSpent: computeMagicApSpent(held, spells, expandedSpecials),
    profession,
  });

  const problems = collectProblems(held, {
    race: race
      ? {
          id: String(race.id),
          name: race.name as string | undefined,
          gp_cost: Number(race.gp_cost ?? 0),
          allowed_cultures: race.allowed_cultures as string[] | undefined,
          attribute_modifiers: race.attribute_modifiers as
            | Record<string, number>
            | undefined,
          attribute_minimums: race.attribute_minimums as
            | Record<string, number>
            | undefined,
          so_min:
            race.so_min != null ? Number(race.so_min) : undefined,
          so_max:
            race.so_max != null ? Number(race.so_max) : undefined,
        }
      : null,
    culture: culture
      ? {
          id: String(culture.id),
          name: culture.name as string | undefined,
          gp_cost: Number(culture.gp_cost ?? 0),
          attribute_modifiers: culture.attribute_modifiers as
            | Record<string, number>
            | undefined,
          attribute_minimums: culture.attribute_minimums as
            | Record<string, number>
            | undefined,
          so_min:
            culture.so_min != null ? Number(culture.so_min) : undefined,
          so_max:
            culture.so_max != null ? Number(culture.so_max) : undefined,
          professions: culture.professions as
            | {
                mode?: string;
                exclude?: string[];
                include?: string[];
              }
            | undefined,
        }
      : null,
    profession: profession
      ? {
          id: String(profession.id),
          name: profession.name as string | undefined,
          gp_cost: professionGp,
          attribute_modifiers: profession.attribute_modifiers as
            | Record<string, number>
            | undefined,
          attribute_minimums: profession.attribute_minimums as
            | Record<string, number>
            | undefined,
          so_min:
            profession.so_min != null
              ? Number(profession.so_min)
              : undefined,
          so_max:
            profession.so_max != null
              ? Number(profession.so_max)
              : undefined,
        }
      : null,
    specialAbilities: expandedSpecials,
    spells,
    talents,
    traits,
    seededTalentIds: seedTalentIdSet,
    grantedSpecialAbilityIds: [
      ...((race?.special_ability_bonuses as Array<{ id?: string }>) || []),
      ...((culture?.special_ability_bonuses as Array<{ id?: string }>) || []),
      ...((profession?.special_ability_bonuses as Array<{ id?: string }>) ||
        []),
      ...((race?.special_abilities as string[]) || []),
      ...((culture?.special_abilities as string[]) || []),
      ...((profession?.special_abilities as string[]) || []),
    ]
      .map((x) => (typeof x === "string" ? x : x.id))
      .filter((id): id is string => Boolean(id)),
    resolveName: (id) => labelMap[id],
    traitGpNet: traitGpNet(held, traits, talents),
    attributeMods,
    finishMode,
  });

  function updateHeld(mutator: (h: HeldModel) => HeldModel) {
    setHeld((prev) => refreshDerived(mutator({ ...prev })));
  }

  function stepIndex(id: StepId) {
    return activeSteps.findIndex((s) => s.id === id);
  }

  function isFoundationStepAccessible(id: StepId): boolean {
    if (id === "race") return true;
    if (id === "culture") return Boolean(held.raceId);
    if (id === "profession") return Boolean(held.cultureId);
    return false;
  }

  function confirmFoundationAndContinue() {
    if (!foundationComplete || foundationLocked) return;
    setFoundationLocked(true);
    updateHeld((h) =>
      applyCreationAttributeMinimums(h, race, profession, culture)
    );
    setStep("bonuses");
  }

  function goNext() {
    if (!veteran && !foundationLocked) {
      if (step === "profession") {
        confirmFoundationAndContinue();
        return;
      }
      if (step === "race" && !held.raceId) return;
      if (step === "culture" && !held.cultureId) return;
    }
    const i = stepIndex(step);
    if (i < activeSteps.length - 1) setStep(activeSteps[i + 1].id);
  }

  function goBack() {
    if (!veteran && foundationLocked && step === "bonuses") {
      // Java: after leaving PanelRasKulProf there is no return.
      return;
    }
    const i = stepIndex(step);
    if (i > 0) setStep(activeSteps[i - 1].id);
  }

  const nextDisabled =
    !veteran &&
    !foundationLocked &&
    ((step === "race" && !held.raceId) ||
      (step === "culture" && !held.cultureId) ||
      (step === "profession" && !foundationComplete));

  const backDisabled =
    stepIndex(step) <= 0 ||
    (!veteran && foundationLocked && step === "bonuses");

  function reseedBausteine(
    secondLanguage: string,
    assignments: Record<string, string[]>,
    mode: "full" | "open-talents-only" = "open-talents-only"
  ) {
    updateHeld((h) =>
      applyFixedBausteine(h, race, culture, profession, {
        secondLanguage,
        openAssignments: assignments,
        openTraitPicks,
        openSpecialPicks,
        openCheapSpecialPick: openCheapSpecialPick || undefined,
        leadSpellPicks,
        mode,
      })
    );
  }

  function applyFullBausteine(
    secondLanguage: string,
    assignments: Record<string, string[]>
  ) {
    updateHeld((h) =>
      applyFixedBausteine(h, race, culture, profession, {
        secondLanguage,
        openAssignments: assignments,
        openTraitPicks,
        openSpecialPicks,
        openCheapSpecialPick: openCheapSpecialPick || undefined,
        leadSpellPicks,
        mode: "full",
      })
    );
  }

  // Auto-apply fixed race/culture/profession bonuses when entering Bonuses
  // or when foundation selection changes.
  useEffect(() => {
    if (step !== "bonuses") return;
    if (!held.raceId || !held.cultureId || !held.professionId) return;
    const key = `${held.raceId}|${held.cultureId}|${held.professionId}`;
    if (key === bausteineKey) return;
    const secondOptions = (culture?.second_languages as string[]) || [];
    const autoSecond =
      secondOptions.length === 1 ? secondOptions[0] : bonusLang;
    if (secondOptions.length === 1) setBonusLang(secondOptions[0]);
    else if (bonusLang && !secondOptions.includes(bonusLang)) {
      setBonusLang("");
    }
    // Java PanelTalentBonusFest: preselect talent[i] for bonus column[i]
    const defaults: Record<string, string[]> = {};
    for (const choice of listOpenTalentBonuses(race, culture, profession)) {
      if (choice.type !== "fixed" || !choice.ranks.length) continue;
      const options = resolveOpenTalentChoiceOptions(choice, talents, {
        motherTongue: culture?.mother_tongue
          ? String(culture.mother_tongue)
          : undefined,
        secondLanguage: autoSecond || undefined,
      });
      defaults[choice.key] = defaultOpenPicks(options, choice.ranks.length);
    }
    setOpenAssignments(defaults);
    setOpenTraitPicks({});
    setOpenSpecialPicks({});
    setOpenCheapSpecialPick("");
    setLeadSpellPicks([]);
    setBausteineKey(key);
    updateHeld((h) =>
      applyFixedBausteine(h, race, culture, profession, {
        secondLanguage: autoSecond,
        openAssignments: defaults,
        openTraitPicks: {},
        openSpecialPicks: {},
        openCheapSpecialPick: undefined,
        leadSpellPicks: [],
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional seed on foundation change
  }, [step, held.raceId, held.cultureId, held.professionId, bausteineKey]);

  const selectClass =
    "mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]";

  if (loading) {
    return (
      <div className="p-6 text-ink-muted">Loading character generator…</div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] flex flex-col">
      {!warnDismissed && warnings.length > 0 && (
        <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 text-sm text-amber-100 flex items-start gap-3">
          <div className="flex-1">
            Some additional/custom content could not be loaded. Built-in catalogs
            are still available.
            <ul className="mt-1 text-xs text-amber-200/80 list-disc pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="text-amber-200/80 hover:text-white text-xs"
            onClick={() => setWarnDismissed(true)}
          >
            Dismiss
          </button>
        </div>
      )}

      {step !== "start" && !veteran && step !== "finish" && (
        <GpApBar
          budget={budget}
          onOpenSettings={() => setSettingsOpen(true)}
          onReset={() => setResetConfirmOpen(true)}
        />
      )}
      {veteran && step !== "sheet" && (
        <VeteranApBar
          held={held}
          onReset={() => setResetConfirmOpen(true)}
        />
      )}
      {(step === "sheet" || step === "finish") && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-surface-border bg-[#1a1410] px-4 py-2 text-sm shadow-md">
          <button
            type="button"
            className="rounded border border-surface-border px-2 py-0.5 text-xs text-ink hover:bg-surface-sidebar/60"
            onClick={() => setResetConfirmOpen(true)}
            title="Reset character generator"
          >
            Reset
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {step !== "start" && (
        <nav className="w-48 shrink-0 border-r border-surface-border p-3 overflow-y-auto hidden md:block">
          <ol className="space-y-1 text-sm">
            {activeSteps.map((s) => {
              const foundationGate =
                !veteran &&
                !foundationLocked &&
                FOUNDATION_STEP_IDS.includes(s.id) &&
                !isFoundationStepAccessible(s.id);
              const disabled = foundationGate;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`w-full text-left px-2 py-1.5 rounded-md ${
                      step === s.id
                        ? "bg-brand-muted text-ink font-medium"
                        : disabled
                          ? "text-ink-faint cursor-not-allowed opacity-50"
                          : "text-ink-muted hover:bg-surface-card"
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      setStep(s.id);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
          {!veteran && foundationLocked && (
            <div className="mt-4 pt-3 border-t border-surface-border text-xs text-ink-muted space-y-1">
              <div className="font-medium text-ink">Foundation</div>
              <div>{race?.name || held.raceId || "—"}</div>
              <div>{culture?.name || held.cultureId || "—"}</div>
              <div>{profession?.name || held.professionId || "—"}</div>
              <p className="text-ink-faint pt-1">
                Locked (as in Java Chargen)
              </p>
            </div>
          )}
        </nav>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {step === "start" && (
            <div className="max-w-lg space-y-4">
              <h2 className="text-xl font-bold text-ink">
                Player Character Generator
              </h2>
              <p className="text-sm text-ink-muted">
                Manual DSA 4.1 point-buy creation, based on the classic Java
                Chargen. Persist a finished hero to the shared database, or load
                one saved by any user. You can also export a{" "}
                <code className="text-xs">.dcg</code> file, or import an existing{" "}
                <code className="text-xs">.dcg</code> /{" "}
                <code className="text-xs">.xml</code> / JSON file.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
                  onClick={() => {
                    setHeld(emptyHeld());
                    setBonusLang("");
                    setOpenAssignments({});
                    setBausteineKey("");
                    setNameFactoryId("");
                    setFoundationLocked(false);
                    setDbHeroId(null);
                    setDbHeroCreatedBy(null);
                    beginModification();
                    setStep("race");
                  }}
                >
                  New hero
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-surface-border text-sm text-ink"
                  onClick={() => setImportOpen(true)}
                >
                  Import file…
                </button>
              </div>
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Load from database
                </p>
                <LoadChargenFromDb
                  onLoad={(payload) => {
                    applyDbHero(payload);
                  }}
                />
              </div>
            </div>
          )}

          {step === "race" && (
            <div className="max-w-xl space-y-3">
              <h2 className="text-lg font-bold">Race</h2>
              <p className="text-sm text-ink-muted">
                Choose race, culture, and profession first. After you continue
                from Profession they are locked, like the Java Chargen.
              </p>
              <select
                className={selectClass}
                value={held.raceId}
                disabled={foundationLocked}
                onChange={(e) => {
                  if (foundationLocked) return;
                  setBausteineKey("");
                  updateHeld((h) => ({
                    ...h,
                    raceId: e.target.value,
                    cultureId: "",
                    professionId: "",
                  }));
                }}
              >
                <option value="">Select…</option>
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.name as string) || r.id}
                    {r.source === "custom" ? " (Custom)" : ""}
                  </option>
                ))}
              </select>
              {race && (
                <p className="text-sm text-ink-muted">
                  GP cost: {String(race.gp_cost ?? 0)}
                  <CustomBadge source={race.source as string} />
                </p>
              )}
            </div>
          )}

          {step === "culture" && (
            <div className="max-w-xl space-y-3">
              <h2 className="text-lg font-bold">Culture</h2>
              {!held.raceId ? (
                <p className="text-sm text-ink-muted">Select a race first.</p>
              ) : (
              <select
                className={selectClass}
                value={held.cultureId}
                disabled={foundationLocked}
                onChange={(e) => {
                  if (foundationLocked) return;
                  setBausteineKey("");
                  updateHeld((h) => ({
                    ...h,
                    cultureId: e.target.value,
                    professionId: "",
                  }));
                }}
              >
                <option value="">Select…</option>
                {filteredCultures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.name as string) || c.id}
                    {c.source === "custom" ? " (Custom)" : ""}
                  </option>
                ))}
              </select>
              )}
            </div>
          )}

          {step === "profession" && (
            <div className="max-w-xl space-y-3">
              <h2 className="text-lg font-bold">Profession</h2>
              {!held.cultureId ? (
                <p className="text-sm text-ink-muted">
                  Select a culture first.
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Continuing locks race, culture, and profession and opens the
                    rest of creation (Java Chargen Weiter).
                  </p>
                  <select
                    className={selectClass}
                    value={held.professionId}
                    disabled={foundationLocked}
                    onChange={(e) => {
                      if (foundationLocked) return;
                      setBausteineKey("");
                      updateHeld((h) => ({
                        ...h,
                        professionId: e.target.value,
                      }));
                    }}
                  >
                    <option value="">Select…</option>
                    {filteredProfessions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.name as string) || p.id}
                        {p.source === "custom" ? " (Custom)" : ""}
                      </option>
                    ))}
                  </select>
                  {profession && (
                    <p className="text-sm text-ink-muted">
                      GP cost: {resolveProfessionGpCost(profession, held.raceId)}
                      <CustomBadge source={profession.source as string} />
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === "bonuses" && (
            <div className="max-w-xl space-y-4">
              <h2 className="text-lg font-bold">Open bonuses</h2>
              <p className="text-sm text-ink-muted">
                Fixed talent bonuses from race, culture, and profession are
                applied automatically. Assign open choices below. Mother tongue
                starts at CL−2 TP; second language at CL−4.
              </p>

              {culture?.mother_tongue ? (
                <p className="text-sm">
                  <span className="text-ink-muted">Mother tongue: </span>
                  {labelMap[String(culture.mother_tongue)] ||
                    String(culture.mother_tongue)}
                </p>
              ) : null}

              {secondLanguageOptions.length > 0 && (
                <label className="block text-sm">
                  <span className="text-ink-muted">
                    Culture second language
                    {secondLanguageOptions.length > 1
                      ? " (choose one)"
                      : " (fixed by culture)"}
                  </span>
                  <select
                    className={selectClass}
                    value={
                      bonusLang ||
                      (secondLanguageOptions.length === 1
                        ? secondLanguageOptions[0].id
                        : "")
                    }
                    disabled={secondLanguageOptions.length === 1}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBonusLang(v);
                      reseedBausteine(v, openAssignments);
                    }}
                  >
                    {secondLanguageOptions.length > 1 && (
                      <option value="">None</option>
                    )}
                    {secondLanguageOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-ink-faint">
                    Fixed by culture when only one option is listed. Profession
                    foreign-language bonuses are chosen separately below.
                  </p>
                </label>
              )}

              {openTalentChoices.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No open talent choices for this race/culture/profession.
                  {(held.talents.length > 0
                    ? ` ${held.talents.length} seeded talents applied.`
                    : "")}
                </p>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Open talent choices</h3>
                  {openTalentChoices.map((choice) => {
                    const effectiveSecondLang =
                      bonusLang ||
                      (secondLanguageOptions.length === 1
                        ? secondLanguageOptions[0]?.id
                        : "");
                    const choiceTalents = resolveOpenTalentChoiceOptions(
                      choice,
                      talents,
                      {
                        motherTongue: culture?.mother_tongue
                          ? String(culture.mother_tongue)
                          : undefined,
                        secondLanguage: effectiveSecondLang || undefined,
                      }
                    );
                    const isLanguagePick =
                      choice.talents.length === 1 &&
                      isTalentListMarker(choice.talents[0]);
                    return (
                    <div
                      key={choice.key}
                      className="rounded-lg border border-surface-border p-3 space-y-2"
                    >
                      <p className="text-sm">
                        <span className="text-ink-muted capitalize">
                          {choice.source}
                        </span>
                        {": "}
                        {choice.type === "fixed"
                          ? isLanguagePick &&
                            choice.talents[0] === "Fremdsprachen"
                            ? `pick a foreign language (${choice.ranks.map((r) => (r >= 0 ? `+${r}` : String(r))).join(", ")})`
                            : `assign ${choice.ranks.map((r) => (r >= 0 ? `+${r}` : String(r))).join(", ")}`
                          : `distribute ${choice.points} free TP`}
                      </p>
                      {choice.type === "fixed" &&
                        choice.ranks.length > 1 ? (
                          <OpenTalentBonusGrid
                            choiceKey={choice.key}
                            ranks={choice.ranks}
                            talentIds={choiceTalents}
                            picks={
                              openAssignments[choice.key]?.length
                                ? openAssignments[choice.key]
                                : defaultOpenPicks(
                                    choiceTalents,
                                    choice.ranks.length
                                  )
                            }
                            labelMap={labelMap}
                            onChange={(nextPicks) => {
                              setOpenAssignments({
                                ...openAssignments,
                                [choice.key]: nextPicks,
                              });
                              reseedBausteine(bonusLang, {
                                ...openAssignments,
                                [choice.key]: nextPicks,
                              });
                            }}
                          />
                        ) : (
                        choice.ranks.map((rank, idx) => {
                          const groupPicks = normalizeOpenPicks(
                            openAssignments[choice.key],
                            choice.ranks.length
                          );
                          const rankOptions = availableForRank(
                            choiceTalents,
                            groupPicks,
                            idx
                          );
                          return (
                          <label key={idx} className="block text-sm">
                            <span className="text-ink-muted">
                              {rank >= 0 ? `+${rank}` : rank} →
                            </span>
                            {isLanguagePick && choiceTalents.length > 6 ? (
                              <div className="mt-1 max-h-48 overflow-y-auto rounded border border-surface-border bg-surface-sidebar/30 p-2 space-y-1">
                                {rankOptions.map((id) => (
                                  <label
                                    key={id}
                                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-sidebar/50 rounded px-1"
                                  >
                                    <input
                                      type="radio"
                                      name={`${choice.key}-${idx}`}
                                      checked={groupPicks[idx] === id}
                                      onChange={() => {
                                        const nextPicks = assignOpenPick(
                                          groupPicks,
                                          idx,
                                          id,
                                          choice.ranks.length
                                        );
                                        const next = {
                                          ...openAssignments,
                                          [choice.key]: nextPicks,
                                        };
                                        setOpenAssignments(next);
                                        reseedBausteine(bonusLang, next);
                                      }}
                                    />
                                    <span>{labelMap[id] || id}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                            <select
                              className={selectClass}
                              value={groupPicks[idx] || ""}
                              onChange={(e) => {
                                const nextPicks = assignOpenPick(
                                  groupPicks,
                                  idx,
                                  e.target.value,
                                  choice.ranks.length
                                );
                                const next = {
                                  ...openAssignments,
                                  [choice.key]: nextPicks,
                                };
                                setOpenAssignments(next);
                                reseedBausteine(bonusLang, next);
                              }}
                            >
                              <option value="">Select talent…</option>
                              {rankOptions.map((id) => (
                                <option key={id} value={id}>
                                  {labelMap[id] || id}
                                </option>
                              ))}
                            </select>
                            )}
                          </label>
                          );
                        })
                        )}
                      {choice.type === "free" && (
                        <div className="space-y-1">
                          {(choice.talents.length
                            ? choice.talents
                            : talents.map((t) => t.id)
                          ).map((id) => {
                            const picks = openAssignments[choice.key] || [];
                            const count = picks.filter((x) => x === id).length;
                            const used = picks.length;
                            return (
                              <div
                                key={id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span className="flex-1 truncate">
                                  {labelMap[id] || id}
                                </span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded border border-surface-border"
                                  disabled={used >= choice.points}
                                  onClick={() => {
                                    const next = {
                                      ...openAssignments,
                                      [choice.key]: [...picks, id],
                                    };
                                    setOpenAssignments(next);
                                    reseedBausteine(bonusLang, next);
                                  }}
                                >
                                  +
                                </button>
                                <span className="w-6 text-center">{count}</span>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded border border-surface-border"
                                  disabled={count <= 0}
                                  onClick={() => {
                                    const i = picks.lastIndexOf(id);
                                    const arr = [...picks];
                                    if (i >= 0) arr.splice(i, 1);
                                    const next = {
                                      ...openAssignments,
                                      [choice.key]: arr,
                                    };
                                    setOpenAssignments(next);
                                    reseedBausteine(bonusLang, next);
                                  }}
                                >
                                  −
                                </button>
                              </div>
                            );
                          })}
                          <p className="text-xs text-ink-muted">
                            Used {(openAssignments[choice.key] || []).length} /{" "}
                            {choice.points}
                          </p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {openTraitChoices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Open advantage / disadvantage choices
                  </h3>
                  {openTraitChoices.map((choice) => (
                    <label key={choice.key} className="block text-sm">
                      <span className="text-ink-muted capitalize">
                        {choice.source}: choose one
                      </span>
                      <select
                        className={selectClass}
                        value={openTraitPicks[choice.key] || ""}
                        onChange={(e) => {
                          const next = {
                            ...openTraitPicks,
                            [choice.key]: e.target.value,
                          };
                          setOpenTraitPicks(next);
                          applyFullBausteine(bonusLang, openAssignments);
                        }}
                      >
                        <option value="">Select…</option>
                        {choice.choices.map((c) => (
                          <option key={c.id} value={c.id}>
                            {labelMap[c.id] || c.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {openSpecialChoices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Open special ability choices
                  </h3>
                  {openSpecialChoices.map((choice) => (
                    <label key={choice.key} className="block text-sm">
                      <span className="text-ink-muted capitalize">
                        {choice.source}: choose one special ability
                      </span>
                      <select
                        className={selectClass}
                        value={openSpecialPicks[choice.key] || ""}
                        onChange={(e) => {
                          const next = {
                            ...openSpecialPicks,
                            [choice.key]: e.target.value,
                          };
                          setOpenSpecialPicks(next);
                          applyFullBausteine(bonusLang, openAssignments);
                        }}
                      >
                        <option value="">Select…</option>
                        {choice.choices.map((c) => (
                          <option key={c.id} value={c.id}>
                            {labelMap[c.id] || c.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {openCheapSpecialChoices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Cheap special ability choice
                  </h3>
                  {openCheapSpecialChoices.map((choice) => (
                    <label key={choice.key} className="block text-sm">
                      <span className="text-ink-muted">
                        Choose one discounted special ability
                      </span>
                      <select
                        className={selectClass}
                        value={openCheapSpecialPick}
                        onChange={(e) => {
                          setOpenCheapSpecialPick(e.target.value);
                          applyFullBausteine(bonusLang, openAssignments);
                        }}
                      >
                        <option value="">Select…</option>
                        {choice.choices.map((c) => (
                          <option key={c.id} value={c.id}>
                            {labelMap[c.id] || c.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {extraLeadSpellCount > 0 && (
                <div className="rounded-lg border border-surface-border p-3 space-y-2">
                  <h3 className="text-sm font-semibold">
                    Please select {extraLeadSpellCount} lead spells.
                  </h3>
                  {autoLeadSpellIds.length > 0 && (
                    <p className="text-xs text-ink-muted">
                      Package spells are already lead spells (
                      {autoLeadSpellIds.length}); choose {extraLeadSpellCount}{" "}
                      additional ones below.
                    </p>
                  )}
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {leadSpellCandidates.map((s) => {
                      const id = String(s.id);
                      const checked = leadSpellPicks.includes(id);
                      const atCap =
                        leadSpellPicks.length >= extraLeadSpellCount;
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2 text-sm ${!checked && atCap ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && atCap}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...leadSpellPicks, id]
                                : leadSpellPicks.filter((x) => x !== id);
                              setLeadSpellPicks(next);
                              updateHeld((h) =>
                                applyFixedBausteine(h, race, culture, profession, {
                                  secondLanguage: bonusLang,
                                  openAssignments,
                                  openTraitPicks,
                                  openSpecialPicks,
                                  openCheapSpecialPick:
                                    openCheapSpecialPick || undefined,
                                  leadSpellPicks: next,
                                })
                              );
                            }}
                          />
                          <span>{(s.name as string) || id}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-ink-muted">
                    Selected {leadSpellPicks.length} / {extraLeadSpellCount}
                  </p>
                </div>
              )}

              {held.talents.length > 0 && (
                <div className="rounded-lg border border-surface-border p-3">
                  <h3 className="text-sm font-semibold mb-2">
                    Seeded talents ({held.talents.length})
                  </h3>
                  <ul className="max-h-48 overflow-y-auto text-sm space-y-0.5">
                    {[...held.talents]
                      .sort((a, b) => b.tp - a.tp)
                      .map((t) => {
                        const eff = effectiveTalentTp(
                          held,
                          t.id,
                          t.tp,
                          attributeMods
                        );
                        return (
                          <li key={t.id} className="flex justify-between gap-2">
                            <span className="truncate">
                              {labelMap[t.id] || t.id}
                            </span>
                            <span className="text-ink-muted shrink-0">
                              TP {eff}
                              {eff !== t.tp ? ` (${t.tp} base)` : ""}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "hero" && (
            <div className="max-w-xl space-y-3">
              <h2 className="text-lg font-bold">Hero data</h2>
              {veteran && (
                <div className="rounded-lg border border-surface-border bg-surface-sidebar/30 px-3 py-2 text-sm">
                  <p className="text-ink-muted">
                    <span className="text-ink font-medium">Race:</span>{" "}
                    {race?.name || held.raceId || "—"}
                    {" · "}
                    <span className="text-ink font-medium">Culture:</span>{" "}
                    {culture?.name || held.cultureId || "—"}
                    {" · "}
                    <span className="text-ink font-medium">Profession:</span>{" "}
                    {profession?.name || held.professionId || "—"}
                  </p>
                  <p className="text-xs text-ink-faint mt-1">
                    Race, culture, and profession are locked after creation.
                  </p>
                </div>
              )}
              <p className="text-sm text-ink-muted">
                {veteran
                  ? "Edit personal details. Appearance and background remain editable."
                  : "Roll dice for name and appearance using race tables and culture name formats (same as the Java Chargen)."}
              </p>

              <label className="block text-sm">
                <span className="text-ink-muted">Name format</span>
                <select
                  className={selectClass}
                  value={activeNameFactoryId}
                  onChange={(e) => setNameFactoryId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {nameFactories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1 min-w-[12rem]">
                  <span className="text-ink-muted">Name</span>
                  <input
                    className={selectClass}
                    value={held.name}
                    onChange={(e) =>
                      updateHeld((h) => ({ ...h, name: e.target.value }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm text-ink hover:bg-surface-card"
                  disabled={!activeNameFactoryId}
                  onClick={() =>
                    updateHeld((h) => ({
                      ...h,
                      name: generateName(h, activeNameFactoryId),
                    }))
                  }
                >
                  Roll name
                </button>
              </div>

              {(
                [
                  ["title", "Title"],
                  ["status", "Status"],
                  ["birthday", "Birthday"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="text-ink-muted">{label}</span>
                  <input
                    className={selectClass}
                    value={held[key]}
                    onChange={(e) =>
                      updateHeld((h) => ({ ...h, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}

              <label className="block text-sm">
                <span className="text-ink-muted">Gender</span>
                <select
                  className={selectClass}
                  value={held.gender}
                  onChange={(e) =>
                    updateHeld((h) => ({
                      ...h,
                      gender: e.target.value as "male" | "female",
                    }))
                  }
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1">
                  <span className="text-ink-muted">Age</span>
                  <input
                    type="number"
                    className={selectClass}
                    value={held.age}
                    onChange={(e) =>
                      updateHeld((h) => ({
                        ...h,
                        age: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm"
                  disabled={!race}
                  title={
                    race?.age
                      ? `${(race.age as { base: number }).base}+1W${(race.age as { dice: number }).dice}`
                      : undefined
                  }
                  onClick={() =>
                    updateHeld((h) => ({
                      ...h,
                      age: rollAge(h, race, profession),
                    }))
                  }
                >
                  Roll
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1">
                  <span className="text-ink-muted">Hair color</span>
                  <input
                    className={selectClass}
                    value={held.hairColor}
                    onChange={(e) =>
                      updateHeld((h) => ({
                        ...h,
                        hairColor: e.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm"
                  disabled={!race}
                  onClick={() =>
                    updateHeld((h) => ({
                      ...h,
                      hairColor: rollHairColor(race),
                    }))
                  }
                >
                  Roll
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1">
                  <span className="text-ink-muted">Eye color</span>
                  <input
                    className={selectClass}
                    value={held.eyeColor}
                    onChange={(e) =>
                      updateHeld((h) => ({
                        ...h,
                        eyeColor: e.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm"
                  disabled={!race}
                  onClick={() =>
                    updateHeld((h) => ({
                      ...h,
                      eyeColor: rollEyeColor(race),
                    }))
                  }
                >
                  Roll
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1">
                  <span className="text-ink-muted">Height (cm)</span>
                  <input
                    type="number"
                    className={selectClass}
                    value={held.heightCm}
                    onChange={(e) => {
                      const heightCm = Number(e.target.value) || 0;
                      updateHeld((h) => ({
                        ...h,
                        heightCm,
                        weightKg: rollWeight(h, race, heightCm),
                      }));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm"
                  disabled={!race}
                  onClick={() =>
                    updateHeld((h) => {
                      const heightCm = rollHeight(race);
                      return {
                        ...h,
                        heightCm,
                        weightKg: rollWeight(h, race, heightCm),
                      };
                    })
                  }
                >
                  Roll
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm flex-1">
                  <span className="text-ink-muted">Weight (kg)</span>
                  <input
                    type="number"
                    className={selectClass}
                    value={held.weightKg}
                    onChange={(e) =>
                      updateHeld((h) => ({
                        ...h,
                        weightKg: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-surface-border text-sm"
                  disabled={!race}
                  onClick={() =>
                    updateHeld((h) => ({
                      ...h,
                      weightKg: rollWeight(h, race),
                    }))
                  }
                >
                  Roll
                </button>
              </div>

              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium"
                disabled={!race}
                onClick={() =>
                  updateHeld((h) => ({
                    ...h,
                    ...rollAllAppearance(h, race, profession),
                    name: activeNameFactoryId
                      ? generateName(h, activeNameFactoryId)
                      : h.name,
                  }))
                }
              >
                Roll all appearance
              </button>

              <label className="block text-sm">
                <span className="text-ink-muted">Appearance</span>
                <textarea
                  className={selectClass}
                  rows={2}
                  value={held.appearance}
                  onChange={(e) =>
                    updateHeld((h) => ({ ...h, appearance: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink-muted">Background</span>
                <textarea
                  className={selectClass}
                  rows={3}
                  value={held.background}
                  onChange={(e) =>
                    updateHeld((h) => ({ ...h, background: e.target.value }))
                  }
                />
              </label>
            </div>
          )}

          {step === "ap" && (
            <VeteranApPanel held={held} updateHeld={updateHeld} />
          )}

          {step === "baseValues" && (
            <BaseValuesStepPanel
              held={held}
              updateHeld={updateHeld}
              attributeMods={attributeMods}
            />
          )}

          {step === "attributes" && veteran && (
            <VeteranAttributesPanel
              held={held}
              updateHeld={updateHeld}
              attributeMods={attributeMods}
              learningMethod={attributeLearningMethod}
              onLearningMethodChange={setAttributeLearningMethod}
            />
          )}

          {step === "attributes" && !veteran && (
            <div className="max-w-2xl space-y-3">
              <h2 className="text-lg font-bold">Attributes</h2>
              {(() => {
                const attrMods = {
                  race:
                    (race?.attribute_modifiers as Record<string, number>) || {},
                  culture:
                    (culture?.attribute_modifiers as Record<string, number>) ||
                    {},
                  profession:
                    (profession?.attribute_modifiers as Record<
                      string,
                      number
                    >) || {},
                };
                const modOf = (code: string) =>
                  (attrMods.race[code] ?? 0) +
                  (attrMods.culture[code] ?? 0) +
                  (attrMods.profession[code] ?? 0);
                const spent = held.attributes
                  .filter((a) => a.code !== "SO")
                  .reduce((s, a) => s + a.base, 0);
                const maxPoints =
                  100 +
                  held.advantagesDisadvantages
                    .filter((t) =>
                      String(t.id).includes("Herausragende") ||
                      String(t.id).includes("Herausragender") ||
                      String(t.id).includes("Herausragendes")
                    )
                    .reduce((s, t) => s + (t.rating ?? 1), 0);
                const over = spent > maxPoints;
                return (
                  <>
                    <p
                      className={`text-sm text-center ${
                        over ? "text-red-400 font-medium" : "text-ink-muted"
                      }`}
                    >
                      {spent} of {maxPoints} points spent.
                    </p>
                    <p className="text-sm text-ink-muted">
                      Race/culture/profession modifiers are free. Only Base
                      costs GP (and counts toward the 100-point pool). Current =
                      Mod + Base.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-surface-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-surface-border text-ink-muted text-left">
                            <th className="px-3 py-2 font-medium">Attribute</th>
                            <th className="px-2 py-2 font-medium text-right w-12">
                              Mod
                            </th>
                            <th className="px-2 py-2 font-medium text-center">
                              Base
                            </th>
                            <th className="px-3 py-2 font-medium text-right w-16">
                              Current
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {held.attributes.map((a) => {
                            const baseMin = a.code === "SO" ? 1 : 8;
                            const baseMax = a.code === "SO" ? 13 : 14;
                            const mod = modOf(a.code);
                            const current = a.base + mod;
                            return (
                              <tr
                                key={a.code}
                                className="border-b border-surface-border/60 last:border-0"
                              >
                                <td className="px-3 py-2">
                                  <span className="font-medium">
                                    {ATTR_LABELS[a.code]}
                                  </span>
                                  <span className="text-ink-faint text-xs ml-1.5">
                                    {a.code}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">
                                  {mod}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      className="px-2 py-0.5 rounded border border-surface-border"
                                      disabled={a.base <= baseMin}
                                      onClick={() =>
                                        updateHeld((h) => ({
                                          ...h,
                                          attributes: h.attributes.map((x) =>
                                            x.code === a.code
                                              ? {
                                                  ...x,
                                                  base: Math.max(
                                                    baseMin,
                                                    x.base - 1
                                                  ),
                                                }
                                              : x
                                          ),
                                        }))
                                      }
                                    >
                                      −
                                    </button>
                                    <span className="w-8 text-center font-mono tabular-nums">
                                      {a.base}
                                    </span>
                                    <button
                                      type="button"
                                      className="px-2 py-0.5 rounded border border-surface-border"
                                      disabled={a.base >= baseMax}
                                      onClick={() =>
                                        updateHeld((h) => ({
                                          ...h,
                                          attributes: h.attributes.map((x) =>
                                            x.code === a.code
                                              ? {
                                                  ...x,
                                                  base: Math.min(
                                                    baseMax,
                                                    x.base + 1
                                                  ),
                                                }
                                              : x
                                          ),
                                        }))
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                  <span className="text-ink-faint mr-1">=</span>
                                  {current}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {step === "talents" && (
            <TalentsStepTable
              held={held}
              updateHeld={updateHeld}
              talentsByGroup={talentsByGroup}
              seedTalentIdSet={seedTalentIdSet}
              seededTpMap={seededTpMap}
              attributeMods={attributeMods}
              talentGroupLabel={talentGroupLabel}
              learningMethod={talentLearningMethod}
              onLearningMethodChange={
                veteran ? setTalentLearningMethod : undefined
              }
            />
          )}

          {step === "special" && (
            <div className="max-w-3xl space-y-3">
              <h2 className="text-lg font-bold">Special abilities</h2>
              {veteran && (
                <LearningMethodSelect
                  value={sfLearningMethod}
                  onChange={setSfLearningMethod}
                />
              )}
              <p className="text-sm text-ink-muted">
                {veteran
                  ? "Learn special abilities with AP. Teacher or Special Experience cost less for specializations."
                  : "Grouped like the Java Chargen. Talent and weapon specializations are listed per skill — pick a variant, then tick the box. Culture Lore, Area Knowledge, and similar abilities also need a variant."}
              </p>
              <div className="max-h-[32rem] overflow-y-auto space-y-4">
                {specialGroups.map((group) => (
                  <section key={group.id}>
                    <h3 className="sticky top-0 z-10 bg-surface-card border-b border-surface-border py-1.5 text-sm font-semibold text-ink">
                      {group.label}
                    </h3>
                    <div className="space-y-1 pt-1">
                      {group.items.map((s) => {
                        const draftRaw = saVariants[s.instanceKey] ?? "";
                        const custom =
                          draftRaw === "__custom__"
                            ? (saCustomVariant[s.instanceKey] || "").trim()
                            : "";
                        const draftVariant =
                          s.variantMode === "none"
                            ? undefined
                            : draftRaw === "__custom__"
                              ? custom || undefined
                              : draftRaw || undefined;
                        const needsVariant = s.variantMode !== "none";
                        const variantReady =
                          !needsVariant || Boolean(draftVariant);
                        const owned = variantReady
                          ? Boolean(
                              findOwnedForInstance(
                                held,
                                { id: s.id, talent: s.talent },
                                draftVariant ?? null
                              )
                            )
                          : held.specialAbilities.some(
                              (x) =>
                                x.id === s.id &&
                                (x.talent || "") === (s.talent || "")
                            );
                        const index = specializationIndex(
                          held,
                          s.id,
                          s.talent,
                          draftVariant ?? null
                        );
                        const ap = veteran
                          ? veteranSpecialAbilityCost(
                              held,
                              s,
                              draftVariant ?? null,
                              sfLearningMethod
                            )
                          : specializationApCost(
                              held,
                              s,
                              draftVariant ?? null
                            );
                        const gpCost = specialAbilityGpCost(
                          held,
                          s,
                          draftVariant ?? null
                        );
                        const prereqs = (s.prerequisites as string[]) || [];
                        const prereqText = formatPrerequisites(prereqs, (id) =>
                          labelMap[id]
                        );
                        const discounted =
                          held.discountedSpecialAbilities.includes(s.id);
                        const granted = [
                          ...((race?.special_ability_bonuses as Array<{
                            id?: string;
                            talent?: string;
                          }>) || []),
                          ...((culture?.special_ability_bonuses as Array<{
                            id?: string;
                            talent?: string;
                          }>) || []),
                          ...((profession?.special_ability_bonuses as Array<{
                            id?: string;
                            talent?: string;
                          }>) || []),
                        ].some(
                          (x) =>
                            x.id === s.id &&
                            (!s.talent ||
                              !x.talent ||
                              x.talent === s.talent)
                        );
                        const attrMods = {
                          race:
                            (race?.attribute_modifiers as Record<
                              string,
                              number
                            >) || {},
                          culture:
                            (culture?.attribute_modifiers as Record<
                              string,
                              number
                            >) || {},
                          profession:
                            (profession?.attribute_modifiers as Record<
                              string,
                              number
                            >) || {},
                        };
                        const { ok: prereqsMet, fails: prereqFails } =
                          isSpecialAbilitySelectable(held, s, {
                            granted,
                            attributeMods: attrMods,
                            resolveName: (id) => labelMap[id],
                            talentId: s.talent,
                            specializationIndex: index,
                          });
                        const creationBlocked =
                          blocksCreationChoice(prereqs) && !granted;
                        const blocked =
                          !owned && (creationBlocked || !prereqsMet);
                        const checkboxDisabled =
                          blocked || (!owned && needsVariant && !variantReady);

                        return (
                          <div
                            key={s.instanceKey}
                            className={`flex items-start gap-2 text-sm px-2 py-1.5 rounded ${
                              blocked
                                ? "opacity-50"
                                : "hover:bg-surface-sidebar/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={owned && variantReady}
                              disabled={checkboxDisabled}
                              onChange={(e) =>
                                updateHeld((h) => {
                                  if (
                                    (!owned && checkboxDisabled) ||
                                    (e.target.checked && !variantReady)
                                  ) {
                                    return h;
                                  }
                                  if (veteran) {
                                    if (e.target.checked) {
                                      return learnSpecialAbilityVeteran(
                                        h,
                                        s,
                                        draftVariant ?? null,
                                        sfLearningMethod
                                      );
                                    }
                                    const refund = veteranSpecialAbilityCost(
                                      h,
                                      s,
                                      draftVariant ?? null,
                                      sfLearningMethod
                                    );
                                    return {
                                      ...h,
                                      specialAbilities: h.specialAbilities.filter(
                                        (x) =>
                                          !(
                                            x.id === s.id &&
                                            (x.talent || "") ===
                                              (s.talent || "") &&
                                            (x.variant || "") ===
                                              (draftVariant || "")
                                          )
                                      ),
                                      apSpent: Math.max(0, h.apSpent - refund),
                                    };
                                  }
                                  const payment = saPayment[s.instanceKey] || "ap";
                                  const cost =
                                    granted || !ap
                                      ? 0
                                      : payment === "gp"
                                        ? 0
                                        : ap;
                                  const entry = {
                                    id: s.id,
                                    talent: s.talent,
                                    variant: draftVariant,
                                    payment:
                                      payment === "gp"
                                        ? ("gp" as const)
                                        : undefined,
                                  };
                                  if (e.target.checked) {
                                    if (
                                      findOwnedForInstance(
                                        h,
                                        entry,
                                        draftVariant ?? null
                                      )
                                    ) {
                                      return h;
                                    }
                                    return {
                                      ...h,
                                      specialAbilities: [
                                        ...h.specialAbilities,
                                        entry,
                                      ],
                                      apSpent:
                                        payment === "ap"
                                          ? h.apSpent + cost
                                          : h.apSpent,
                                    };
                                  }
                                  const ownedRow = h.specialAbilities.find(
                                    (x) =>
                                      x.id === s.id &&
                                      (x.talent || "") === (s.talent || "") &&
                                      (x.variant || "") === (draftVariant || "")
                                  );
                                  const refund =
                                    ownedRow?.payment === "gp" ? 0 : cost;
                                  return {
                                    ...h,
                                    specialAbilities: h.specialAbilities.filter(
                                      (x) =>
                                        !(
                                          x.id === s.id &&
                                          (x.talent || "") ===
                                            (s.talent || "") &&
                                          (x.variant || "") ===
                                            (draftVariant || "")
                                        )
                                    ),
                                    apSpent: Math.max(0, h.apSpent - refund),
                                  };
                                })
                              }
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="font-medium">
                                {s.displayName}
                                <CustomBadge source={s.source as string} />
                              </div>
                              {needsVariant && (
                                <div className="flex flex-wrap items-center gap-2">
                                  {s.variantMode === "free_text" &&
                                  !s.variantOptions.length ? (
                                    <input
                                      type="text"
                                      className="rounded border border-surface-border bg-surface-sidebar px-2 py-0.5 text-xs max-w-xs"
                                      placeholder="Variant / place name"
                                      value={saVariants[s.instanceKey] || ""}
                                      onChange={(e) =>
                                        setSaVariants((prev) => ({
                                          ...prev,
                                          [s.instanceKey]: e.target.value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <>
                                      <select
                                        className="rounded border border-surface-border bg-surface-sidebar px-2 py-0.5 text-xs max-w-xs"
                                        value={saVariants[s.instanceKey] || ""}
                                        onChange={(e) =>
                                          setSaVariants((prev) => ({
                                            ...prev,
                                            [s.instanceKey]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">
                                          Select variant…
                                        </option>
                                        {s.variantOptions.map((o) => (
                                          <option key={o.id} value={o.id}>
                                            {o.name}
                                          </option>
                                        ))}
                                        {s.freeVariant && (
                                          <option value="__custom__">
                                            Other…
                                          </option>
                                        )}
                                      </select>
                                      {saVariants[s.instanceKey] ===
                                        "__custom__" && (
                                        <input
                                          type="text"
                                          className="rounded border border-surface-border bg-surface-sidebar px-2 py-0.5 text-xs max-w-xs"
                                          placeholder="Custom specialization"
                                          value={
                                            saCustomVariant[s.instanceKey] || ""
                                          }
                                          onChange={(e) =>
                                            setSaCustomVariant((prev) => ({
                                              ...prev,
                                              [s.instanceKey]: e.target.value,
                                            }))
                                          }
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                              <div className="text-xs text-ink-muted">
                                {[
                                  granted
                                    ? "granted"
                                    : ap
                                      ? `${ap} AP`
                                      : null,
                                  discounted ? "discounted" : null,
                                  prereqText || null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                              {!prereqsMet && !granted && (
                                <div className="text-xs text-red-400/90">
                                  Missing:{" "}
                                  {prereqFails.map((f) => f.message).join("; ")}
                                </div>
                              )}
                              {!veteran && !granted && ap > 0 && (
                                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                                  <span>Pay with:</span>
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`pay-${s.instanceKey}`}
                                      checked={
                                        (saPayment[s.instanceKey] || "ap") ===
                                        "ap"
                                      }
                                      onChange={() =>
                                        setSaPayment((prev) => ({
                                          ...prev,
                                          [s.instanceKey]: "ap",
                                        }))
                                      }
                                    />
                                    AP ({ap}
                                    {discounted ? " · discounted" : ""})
                                  </label>
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`pay-${s.instanceKey}`}
                                      checked={saPayment[s.instanceKey] === "gp"}
                                      onChange={() =>
                                        setSaPayment((prev) => ({
                                          ...prev,
                                          [s.instanceKey]: "gp",
                                        }))
                                      }
                                    />
                                    GP ({gpCost})
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {held.specialAbilities.length > 0 && (
                <div className="rounded border border-surface-border bg-surface-sidebar/40 p-2 text-xs text-ink-muted">
                  <div className="font-medium text-ink mb-1">Selected</div>
                  <ul className="space-y-0.5">
                    {held.specialAbilities.map((sa, i) => (
                      <li key={`${sa.id}|${sa.talent}|${sa.variant}|${i}`}>
                        {formatSpecialAbilityLabel(sa, (id) => labelMap[id])}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "traits" && veteran && (
            <VeteranTraitsPanel
              held={held}
              updateHeld={updateHeld}
              traits={traits}
              learningMethod={traitLearningMethod}
              onLearningMethodChange={setTraitLearningMethod}
              labelMap={labelMap}
            />
          )}

          {step === "traits" && !veteran && (
            <div className="max-w-2xl space-y-3">
              <h2 className="text-lg font-bold">
                Advantages / Disadvantages
              </h2>
              <p className="text-sm text-ink-muted">
                GP costs and level ranges from the rules. Traits marked as not
                suitable for your race/culture/profession cannot be chosen.
                Granted traits are pre-selected.
              </p>
              {connectionPoints > 0 && (
                <div className="rounded-lg border border-surface-border p-3 space-y-2">
                  <h3 className="text-sm font-semibold">Connections</h3>
                  <p className="text-xs text-ink-muted">
                    {connectionPoints} free connection points from your
                    profession. Levels above the free pool cost GP (1 GP per 3
                    levels, or per 5 with Social Adaptability).
                  </p>
                  <label className="block text-sm">
                    <span className="text-ink-muted">Connections level</span>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-24 rounded border border-surface-border bg-[#2c251f] px-2 py-1"
                      value={
                        connectionLevels["VorNachteil.Verbindungen"] ??
                        held.advantagesDisadvantages.find(
                          (x) => x.id === "VorNachteil.Verbindungen"
                        )?.rating ??
                        0
                      }
                      onChange={(e) => {
                        const level = Math.max(0, Number(e.target.value) || 0);
                        setConnectionLevels((prev) => ({
                          ...prev,
                          "VorNachteil.Verbindungen": level,
                        }));
                        updateHeld((h) => {
                          const rest = h.advantagesDisadvantages.filter(
                            (x) => x.id !== "VorNachteil.Verbindungen"
                          );
                          if (level <= 0) {
                            return { ...h, advantagesDisadvantages: rest };
                          }
                          return {
                            ...h,
                            advantagesDisadvantages: [
                              ...rest,
                              {
                                id: "VorNachteil.Verbindungen",
                                rating: level,
                                granted: connectionPoints > 0,
                                grantedRating: connectionPoints,
                              },
                            ],
                          };
                        });
                      }}
                    />
                    <span className="ml-2 text-xs text-ink-faint">
                      ({connectionPoints} free)
                    </span>
                  </label>
                </div>
              )}
              <div className="max-h-[28rem] overflow-y-auto space-y-1">
                {traits.map((t) => {
                  const owned = held.advantagesDisadvantages.some(
                    (x) => x.id === t.id
                  );
                  const ownedRow = held.advantagesDisadvantages.find(
                    (x) => x.id === t.id
                  );
                  const granted = Boolean(ownedRow?.granted);
                  const unsuitable = unsuitableTraits.has(t.id);
                  const ratingMin =
                    t.rating_min != null ? Number(t.rating_min) : null;
                  const ratingMax =
                    t.rating_max != null ? Number(t.rating_max) : null;
                  const openEnded = Boolean(t.rating_open_ended) ||
                    (ratingMin != null && ratingMax == null);
                  const metaLine = formatTraitMeta(
                    {
                      kind: t.kind as string,
                      gp_cost: t.gp_cost as number | null,
                      gp_per_level: t.gp_per_level as number | null,
                      rating_min: ratingMin,
                      rating_max: ratingMax,
                      kosten_key: t.kosten_key as string | null,
                      cost_label: t.cost_label as string | null,
                    },
                    { unsuitable }
                  );
                  const showRating =
                    owned &&
                    (ratingMin != null || ratingMax != null || openEnded);
                  const kostenKey = String(t.kosten_key || "");
                  const needsTalentVariant =
                    kostenKey === "BEGABUNG_TALENT" ||
                    kostenKey === "UNFAEHIGKEIT_TALENT";
                  const needsGroupVariant =
                    kostenKey === "BEGABUNG_TALENTGRUPPE" ||
                    kostenKey === "UNFAEHIGKEIT_TALENTGRUPPE";
                  const needsSpecialItem = kostenKey === "BESONDERER_BESITZ";
                  return (
                    <div
                      key={t.id}
                      className={`flex items-start gap-2 text-sm px-2 py-1.5 rounded ${
                        unsuitable
                          ? "opacity-50"
                          : "hover:bg-surface-sidebar/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={owned}
                        disabled={(unsuitable && !owned) || granted}
                        onChange={(e) =>
                          updateHeld((h) => {
                            if (granted) return h;
                            return {
                              ...h,
                              advantagesDisadvantages: e.target.checked
                                ? [
                                    ...h.advantagesDisadvantages,
                                    {
                                      id: t.id,
                                      rating:
                                        ratingMin != null
                                          ? ratingMin
                                          : undefined,
                                    },
                                  ]
                                : h.advantagesDisadvantages.filter(
                                    (x) => x.id !== t.id
                                  ),
                            };
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div>
                          <span className="font-medium">
                            {(t.name as string) || t.id}
                          </span>
                          {granted ? (
                            <span className="ml-1 text-xs text-ink-muted">
                              (granted · 0 GP)
                            </span>
                          ) : null}
                          <CustomBadge source={t.source as string} />
                        </div>
                        {metaLine ? (
                          <div className="text-xs text-ink-muted">{metaLine}</div>
                        ) : null}
                        {showRating && (
                          <label className="mt-1 flex items-center gap-2 text-xs">
                            Level
                            <input
                              type="number"
                              min={
                                ownedRow?.grantedRating != null
                                  ? ownedRow.grantedRating
                                  : (ratingMin ?? 1)
                              }
                              max={openEnded ? undefined : ratingMax ?? undefined}
                              className="w-16 rounded border border-surface-border bg-[#2c251f] px-1 py-0.5"
                              value={ownedRow?.rating ?? ratingMin ?? 1}
                              onChange={(e) =>
                                updateHeld((h) => ({
                                  ...h,
                                  advantagesDisadvantages:
                                    h.advantagesDisadvantages.map((x) => {
                                      if (x.id !== t.id) return x;
                                      const floor =
                                        x.grantedRating != null
                                          ? x.grantedRating
                                          : ratingMin ?? 1;
                                      const next = Math.max(
                                        floor,
                                        Number(e.target.value) || floor
                                      );
                                      return { ...x, rating: next };
                                    }),
                                }))
                              }
                            />
                            <span className="text-ink-faint">
                              {ownedRow?.grantedRating != null
                                ? `(${ownedRow.grantedRating}+ free; GP for levels above)`
                                : openEnded
                                  ? `(${ratingMin ?? 1}+)`
                                  : ratingMin != null && ratingMax != null
                                    ? `(${ratingMin}–${ratingMax})`
                                    : null}
                            </span>
                          </label>
                        )}
                        {owned && needsSpecialItem && specialItemOptions.length > 0 && (
                          <label className="mt-1 block text-xs">
                            <span className="text-ink-muted">Special item</span>
                            <select
                              className={`${selectClass} mt-0.5`}
                              value={ownedRow?.variant || ""}
                              onChange={(e) =>
                                updateHeld((h) => ({
                                  ...h,
                                  advantagesDisadvantages:
                                    h.advantagesDisadvantages.map((x) =>
                                      x.id === t.id
                                        ? { ...x, variant: e.target.value }
                                        : x
                                    ),
                                }))
                              }
                            >
                              <option value="">Select item…</option>
                              {specialItemOptions.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {owned && needsTalentVariant && (
                          <label className="mt-1 block text-xs">
                            <span className="text-ink-muted">Talent</span>
                            <select
                              className={`${selectClass} mt-0.5`}
                              value={ownedRow?.variant || ""}
                              onChange={(e) =>
                                updateHeld((h) => ({
                                  ...h,
                                  advantagesDisadvantages:
                                    h.advantagesDisadvantages.map((x) =>
                                      x.id === t.id
                                        ? { ...x, variant: e.target.value }
                                        : x
                                    ),
                                }))
                              }
                            >
                              <option value="">Select talent…</option>
                              {talents.map((tal) => (
                                <option key={tal.id} value={tal.id}>
                                  {(tal.name as string) || tal.id}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {owned && needsGroupVariant && (
                          <label className="mt-1 block text-xs">
                            <span className="text-ink-muted">Talent group</span>
                            <select
                              className={`${selectClass} mt-0.5`}
                              value={ownedRow?.variant || ""}
                              onChange={(e) =>
                                updateHeld((h) => ({
                                  ...h,
                                  advantagesDisadvantages:
                                    h.advantagesDisadvantages.map((x) =>
                                      x.id === t.id
                                        ? { ...x, variant: e.target.value }
                                        : x
                                    ),
                                }))
                              }
                            >
                              <option value="">Select group…</option>
                              {TALENT_GROUP_ORDER.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "spells" && (
            <div className="max-w-3xl space-y-3">
              <h2 className="text-lg font-bold">Spells (AP)</h2>
              {veteran && (
                <LearningMethodSelect
                  value={spellLearningMethod}
                  onChange={setSpellLearningMethod}
                />
              )}
              {!veteran && spellcasterBlocked(held) && (
                <p className="text-sm text-amber-400/90">
                  Spells require the Spellcaster advantage (20 GP). Without it,
                  no spell points can be allocated during creation.
                </p>
              )}
              <div className="max-h-[28rem] overflow-y-auto space-y-1">
                {spells.map((s) => {
                  const row = held.spells.find((x) => x.id === s.id);
                  const sp = row?.sp ?? 0;
                  const blockReason = spellBlockReason(held, s);
                  const blocked = !veteran && !row && blockReason !== null;
                  const nextCost = spellDisplayApCost(
                    held,
                    s,
                    spellLearningMethod
                  );
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                        blocked
                          ? "opacity-50"
                          : "hover:bg-surface-sidebar/50"
                      }`}
                      title={blockReason ?? undefined}
                    >
                      <span
                        className={`flex-1 truncate ${
                          blocked ? "text-red-400" : ""
                        }`}
                      >
                        {(s.name as string) || s.id}
                        <CustomBadge source={s.source as string} />
                      </span>
                      <span className="text-xs font-mono text-ink-muted w-14 text-right">
                        {nextCost} AP
                      </span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                        disabled={blocked && !row}
                        onClick={() =>
                          updateHeld((h) =>
                            addOrRaiseSpell(h, s, spellLearningMethod)
                          )
                        }
                      >
                        +
                      </button>
                      <span className="w-8 text-center font-mono">{sp}</span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border"
                        disabled={!row}
                        onClick={() =>
                          updateHeld((h) =>
                            lowerOrRemoveSpell(h, s, spellLearningMethod)
                          )
                        }
                      >
                        −
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "equipment" && (
            <div className="max-w-3xl space-y-6">
              <h2 className="text-lg font-bold">Equipment</h2>
              {(
                [
                  ["Melee weapons (max 5)", melee, "meleeWeapons", 5],
                  ["Ranged weapons (max 3)", ranged, "rangedWeapons", 3],
                  ["Armor (max 5)", armors, "armors", 5],
                  ["Shields (max 3)", shields, "shields", 3],
                ] as const
              ).map(([title, list, field, max]) => (
                <div key={field}>
                  <h3 className="text-sm font-semibold text-ink mb-2">
                    {title}
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-surface-border rounded-lg p-2">
                    {list.map((item) => {
                      const current = held[field] as { id: string }[];
                      const owned = current.some((x) => x.id === item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={owned}
                            onChange={(e) =>
                              updateHeld((h) => {
                                const arr = [
                                  ...(h[field] as { id: string; name?: string }[]),
                                ];
                                if (e.target.checked) {
                                  if (arr.length >= max) return h;
                                  arr.push({
                                    id: item.id,
                                    name: item.name as string,
                                    ...(field === "meleeWeapons"
                                      ? {
                                          tp: item.tp as string,
                                          bf: item.bf as number,
                                          ini: item.ini as number,
                                          wmAt: item.wm_at as number,
                                          wmPa: item.wm_pa as number,
                                        }
                                      : {}),
                                    ...(field === "armors"
                                      ? {
                                          rs: item.rs as number,
                                          be: item.be as number,
                                        }
                                      : {}),
                                    ...(field === "shields"
                                      ? {
                                          type: item.type as string,
                                          bf: item.bf as number,
                                          ini: item.ini as number,
                                          wmAt: item.wm_at as number,
                                          wmPa: item.wm_pa as number,
                                        }
                                      : {}),
                                    ...(field === "rangedWeapons"
                                      ? {
                                          tp: item.tp as string,
                                          ranges: item.ranges as number[],
                                        }
                                      : {}),
                                  });
                                } else {
                                  return {
                                    ...h,
                                    [field]: arr.filter((x) => x.id !== item.id),
                                  };
                                }
                                return { ...h, [field]: arr };
                              })
                            }
                          />
                          <span>
                            {(item.name as string) || item.id}
                            <CustomBadge source={item.source as string} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "problems" && (
            <div className="max-w-2xl space-y-4">
              <h2 className="text-lg font-bold">Problems</h2>
              <ProblemsPanel
                conflicts={problems.conflicts}
                canFinish={problems.canFinish}
                advisoryMode={finishMode === "advisory"}
                hasSpecialAbilityPrereqIssues={
                  problems.hasSpecialAbilityPrereqIssues
                }
              />
              <button
                type="button"
                disabled={!problems.canFinish}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-40"
                onClick={() => {
                  updateHeld((h) =>
                    finishCreation(h, attributeMods, budget.gpRemaining)
                  );
                  setFoundationLocked(true);
                  setStep("ap");
                }}
              >
                Finish hero
              </button>
            </div>
          )}

          {(step === "finish" || step === "sheet") && (
            <ChargenSheetView
              held={held}
              dbHeroId={dbHeroId}
              modificationActive={modificationActive}
              onFinishCreation={() => setModificationActive(false)}
              onPersisted={(id) => {
                setDbHeroId(id);
              }}
              labels={{
                race: race?.name as string | undefined,
                culture: culture?.name as string | undefined,
                profession: profession?.name as string | undefined,
                byId: labelMap,
              }}
            />
          )}

          {step !== "start" &&
            step !== "finish" &&
            step !== "sheet" && (
            <div className="mt-8 flex gap-2 border-t border-surface-border pt-4">
              <button
                type="button"
                disabled={backDisabled}
                className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar disabled:opacity-40 disabled:pointer-events-none"
                onClick={goBack}
              >
                Back
              </button>
              <button
                type="button"
                disabled={nextDisabled}
                className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-40 disabled:pointer-events-none"
                onClick={goNext}
              >
                {!veteran && !foundationLocked && step === "profession"
                  ? "Continue"
                  : "Next"}
              </button>
            </div>
          )}
        </div>
      </div>

      <ImportChargenDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(h) => {
          setHeld(refreshDerived(h));
          setDbHeroId(null);
          setDbHeroCreatedBy(null);
          setFoundationLocked(true);
          beginModification();
          setStep("ap");
        }}
      />

      <ChargenSettingsDialog
        open={settingsOpen}
        finishMode={finishMode}
        onFinishModeChange={(mode) => {
          setFinishMode(mode);
          saveChargenSettings({ finishMode: mode });
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset character generator?"
        message="This discards the current hero and returns to the start page. Unsaved changes will be lost."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        danger
        onConfirm={performReset}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}

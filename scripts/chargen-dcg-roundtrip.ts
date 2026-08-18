/**
 * Semantic DCG round-trip smoke for Java Chargen compatibility.
 *
 * Run: npx tsx scripts/chargen-dcg-roundtrip.ts
 *
 * Checks:
 * 1. Import Wulfgrimm fixture → export → re-import → semantic HeldModel equality
 * 2. Optional Java FactoryHeldXmlIn probe on original (expect fail) and Nexus export (expect ok)
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { importLegacyHeldXml } from "../lib/chargen/io/importLegacyXml";
import { exportLegacyHeldXml } from "../lib/chargen/io/exportLegacyXml";
import type { HeldModel } from "../lib/chargen/types";
import { stripSessionBaselines } from "../lib/chargen/rules/veteran";
import { getBuiltinCatalog } from "../lib/chargen/data/builtinCatalog";
import { isCombatTalent } from "../lib/chargen/rules/talentActivation";
import { recomputeDerived } from "../lib/chargen/rules/derived";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(
  ROOT,
  "lib/chargen/io/fixtures/wulfgrimm-manaferson.dcg"
);
const OUT_DIR = path.join(ROOT, "tmp/chargen-dcg-roundtrip");
const JAVA_CHARGEN = process.env.CHARGEN_HOME || "D:\\Work\\TDE\\Chargen";

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`OK: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

/** Stable semantic snapshot for deep compare (ignore session baselines / order-insensitive lists sorted). */
function semanticSnapshot(held: HeldModel): unknown {
  const h = stripSessionBaselines(held);
  const sortById = <T extends { id: string }>(arr: T[]) =>
    [...arr].sort((a, b) => a.id.localeCompare(b.id));
  return {
    name: h.name,
    raceId: h.raceId,
    cultureId: h.cultureId,
    professionId: h.professionId,
    gender: h.gender,
    birthday: h.birthday,
    age: h.age,
    heightCm: h.heightCm,
    weightKg: h.weightKg,
    hairColor: h.hairColor,
    eyeColor: h.eyeColor,
    appearance: h.appearance,
    status: h.status,
    title: h.title,
    background: h.background,
    apTotal: h.apTotal,
    apSpent: h.apSpent,
    kapital: h.kapital ?? null,
    motherTongue: h.motherTongue ?? null,
    secondLanguage: h.secondLanguage ?? null,
    attributes: h.attributes.map((a) => ({
      code: a.code,
      base: a.base,
      purchased: a.purchased ?? 0,
      specialExperience: !!a.specialExperience,
    })),
    // Compare XML Bonus only (modification minus live package is done on export;
    // after re-import, packageBaseline=0 so modification is XML Bonus again).
    derivedBonus: h.derived
      .filter((d) => d.code !== "GS")
      .map((d) => ({
        code: d.code,
        // After fresh import, modification is XML Bonus (packageBaseline=0).
        bonus: d.modification,
        purchased: d.purchased ?? 0,
        specialExperience: !!d.specialExperience,
      })),
    talents: sortById(
      h.talents.map((t) => {
        const meta = getBuiltinCatalog("talents").find((c) => c.id === t.id);
        const kampf = meta ? isCombatTalent(meta) : false;
        return {
          id: t.id,
          tp: t.tp ?? 0,
          // Java Out always writes Attacke for Kampf; missing attr ≡ 0.
          attack: kampf ? t.attack ?? 0 : t.attack ?? null,
          specialExperience: !!t.specialExperience,
          activated: t.activated === false ? false : null,
        };
      })
    ),
    leadTalents: [...h.leadTalents].sort(),
    spells: sortById(
      h.spells.map((s) => ({
        id: s.id,
        sp: s.sp ?? 0,
        variant: s.variant || null,
        specialExperience: !!s.specialExperience,
      }))
    ),
    houseSpells: [...h.houseSpells].sort(),
    leadSpells: [...h.leadSpells].sort(),
    specialAbilities: sortById(
      h.specialAbilities.map((s) => ({
        id: s.id,
        talent: s.talent || null,
        variant: s.variant || null,
      }))
    ),
    discountedSpecialAbilities: [...h.discountedSpecialAbilities].sort(),
    discountedSpecialAbilityVariants: sortById(
      (h.discountedSpecialAbilityVariants || []).map((v) => ({
        id: v.id,
        talent: v.talent || null,
        variant: v.variant || null,
      }))
    ),
    advantagesDisadvantages: sortById(
      h.advantagesDisadvantages.map((t) => ({
        id: t.id,
        rating: t.rating ?? null,
        variant: t.variant || null,
        specialExperience: !!t.specialExperience,
      }))
    ),
    meleeWeapons: sortById(
      h.meleeWeapons.map((w) => ({
        id: w.id,
        name: w.name || null,
        talent: w.talent || null,
        tp: w.tp || null,
        bf: w.bf ?? 0,
        ini: w.ini ?? 0,
        wmAt: w.wmAt ?? 0,
        wmPa: w.wmPa ?? 0,
        dkH: !!w.dkH,
        dkN: !!w.dkN,
        dkS: !!w.dkS,
        damageStep: w.damageStep ?? 0,
        damageThreshold: w.damageThreshold ?? 0,
      }))
    ),
    rangedWeapons: sortById(
      h.rangedWeapons.map((w) => ({
        id: w.id,
        name: w.name || null,
        talent: w.talent || null,
        tp: w.tp || null,
        ranges: w.ranges || null,
        tpPlus: w.tpPlus || null,
      }))
    ),
    armors: sortById(
      h.armors.map((a) => ({
        id: a.id,
        name: a.name || null,
        rs: a.rs ?? 0,
        be: a.be ?? 0,
      }))
    ),
    shields: sortById(
      h.shields.map((s) => ({
        id: s.id,
        name: s.name || null,
        type: s.type || null,
        bf: s.bf ?? 0,
        ini: s.ini ?? 0,
        wmAt: s.wmAt ?? 0,
        wmPa: s.wmPa ?? 0,
      }))
    ),
  };
}

function diffPaths(a: unknown, b: unknown, prefix = ""): string[] {
  const out: string[] = [];
  if (Object.is(a, b)) return out;
  if (typeof a !== typeof b || a === null || b === null) {
    out.push(`${prefix || "(root)"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      out.push(...diffPaths(a[i], b[i], `${prefix}[${i}]`));
    }
    return out;
  }
  if (typeof a === "object" && typeof b === "object") {
    const keys = new Set([
      ...Object.keys(a as object),
      ...Object.keys(b as object),
    ]);
    for (const k of [...keys].sort()) {
      out.push(
        ...diffPaths(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          prefix ? `${prefix}.${k}` : k
        )
      );
    }
    return out;
  }
  out.push(`${prefix}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  return out;
}

function ensureCleanChargenClasses(): { ok: true; classesDir: string } | { ok: false; message: string } {
  const jar = path.join(JAVA_CHARGEN, "chargen.jar");
  if (!fs.existsSync(jar)) {
    return { ok: false, message: `chargen.jar not found at ${jar}` };
  }
  const classesDir = path.join(OUT_DIR, "chargen-classes");
  const marker = path.join(classesDir, ".extracted");
  if (fs.existsSync(marker)) {
    return { ok: true, classesDir };
  }
  // chargen.jar contains illegal "../META-INF/…" entries that break Java 17 ZipFS/javac.
  // Extract with Python zipfile (skips/normalizes) into a plain class directory.
  const py = `
import zipfile, os, sys
src = sys.argv[1]
dst = sys.argv[2]
os.makedirs(dst, exist_ok=True)
with zipfile.ZipFile(src) as z:
    for info in z.infolist():
        name = info.filename.replace("\\\\", "/")
        while name.startswith("../"):
            name = name[3:]
        if not name or name.endswith("/"):
            continue
        if ".." in name.split("/"):
            continue
        target = os.path.join(dst, *name.split("/"))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(info) as src_f, open(target, "wb") as out_f:
            out_f.write(src_f.read())
open(os.path.join(dst, ".extracted"), "w").write("ok")
`;
  const extract = spawnSync(
    "python",
    ["-c", py, jar, classesDir],
    { encoding: "utf8" }
  );
  if (extract.status !== 0) {
    return {
      ok: false,
      message: `extract failed: ${extract.stderr || extract.stdout}`,
    };
  }
  return { ok: true, classesDir };
}

function runJavaProbe(xmlPath: string, _label: string): { ok: boolean; message: string } {
  const nano = path.join(JAVA_CHARGEN, "lib", "nanoxml-2.2.3.jar");
  const extracted = ensureCleanChargenClasses();
  if (!extracted.ok) return extracted;

  const probeDir = path.join(OUT_DIR, "java-probe");
  fs.mkdirSync(probeDir, { recursive: true });
  const pkgDir = path.join(probeDir, "probe");
  fs.mkdirSync(pkgDir, { recursive: true });
  const javaFile = path.join(pkgDir, "DcgLoadProbe.java");
  const compileCp = [extracted.classesDir, nano].join(path.delimiter);
  const runCp = [probeDir, extracted.classesDir, nano].join(path.delimiter);

  fs.writeFileSync(
    javaFile,
    `package probe;
import java.io.FileInputStream;
import net.n3.nanoxml.IXMLElement;
import net.n3.nanoxml.IXMLParser;
import net.n3.nanoxml.StdXMLReader;
import net.n3.nanoxml.XMLParserFactory;
import de.bernhardjung.dsaprogramm.basis.heldio.FactoryHeldXmlIn;
import de.bernhardjung.dsaprogramm.basis.Held;
import de.bernhardjung.dsaprogramm.basis.Kulturkunde;
import de.bernhardjung.dsaprogramm.basiswerte.Basiswert;
import de.bernhardjung.dsaprogramm.daten.Datenspeicher;
import de.bernhardjung.dsaprogramm.eigenschaften.Eigenschaft;
import de.bernhardjung.dsaprogramm.sonderfertigkeiten.Sonderfertigkeit;
import de.bernhardjung.dsaprogramm.talente.Talent;
import de.bernhardjung.dsaprogramm.vornachteile.VorNachteil;
import de.bernhardjung.dsaprogramm.zauber.Zauber;

public class DcgLoadProbe {
  public static void main(String[] args) throws Exception {
    Basiswert.initialisieren();
    Eigenschaft.initialisieren();
    Talent.initialisieren();
    Kulturkunde.initialisieren();
    Sonderfertigkeit.initialisieren();
    VorNachteil.initialisieren();
    Zauber.initialisieren();
    Datenspeicher.getInstanz().ladeDaten();

    IXMLParser parser = XMLParserFactory.createDefaultXMLParser();
    parser.setReader(new StdXMLReader(new FileInputStream(args[0])));
    Held held = new FactoryHeldXmlIn().erzeugen((IXMLElement) parser.parse());
    System.out.println("LOADED:" + held.getName());
  }
}
`
  );

  const compile = spawnSync(
    "javac",
    ["-encoding", "UTF-8", "-cp", compileCp, "-d", probeDir, javaFile],
    { encoding: "utf8" }
  );
  if (compile.status !== 0) {
    return {
      ok: false,
      message: `javac failed: ${compile.stderr || compile.stdout}`,
    };
  }

  const run = spawnSync("java", ["-cp", runCp, "probe.DcgLoadProbe", xmlPath], {
    encoding: "utf8",
  });
  const combined = `${run.stdout || ""}${run.stderr || ""}`.trim();
  if (run.status === 0 && combined.includes("LOADED:")) {
    return { ok: true, message: combined.split("\n").pop() || "ok" };
  }
  const errLine =
    combined
      .split(/\r?\n/)
      .filter((l) => /Exception|Error|null/i.test(l))
      .slice(0, 4)
      .join(" | ") || combined.slice(0, 400);
  return { ok: false, message: errLine || `exit ${run.status}` };
}

function main() {
  console.log("=== chargen-dcg-roundtrip ===");
  check("fixture exists", fs.existsSync(FIXTURE), FIXTURE);

  const raw = fs.readFileSync(FIXTURE, "utf8");
  const imported = importLegacyHeldXml(raw);
  check("import name", imported.name === "Wulfgrimm Manaferson");
  check("import race", imported.raceId === "Rasse.Thorwaler");
  check("import kapital", imported.kapital === 4900);
  check(
    "import Kulturkunde variant (child Variante)",
    imported.specialAbilities.some(
      (s) =>
        s.id === "Sonderfertigkeit.Kulturkunde" &&
        s.variant === "Kulturkunde.Mittelreich"
    )
  );
  check(
    "import Talentgruppe → nature",
    imported.advantagesDisadvantages.some(
      (t) =>
        t.id === "VorNachteil.UnfaehigkeitFuerTalentgruppe" &&
        t.variant === "nature"
    )
  );
  check(
    "import melee Tp 1d6+4",
    imported.meleeWeapons[0]?.tp === "1d6+4"
  );
  check(
    "import Zweihandschwerter Attacke",
    imported.talents.find((t) => t.id === "Talent.Zweihandschwerter")?.attack ===
      7
  );

  // Derived Bonus preservation: XML Bonus must survive recomputeDerived + export.
  {
    const withBonus = importLegacyHeldXml(raw);
    const vp = withBonus.derived.find((d) => d.code === "VP");
    if (vp) vp.modification = 5; // player XML Bonus (packageBaseline still 0)
    const race = getBuiltinCatalog("races").find(
      (r) => r.id === withBonus.raceId
    );
    const culture = getBuiltinCatalog("cultures").find(
      (c) => c.id === withBonus.cultureId
    );
    const profession = getBuiltinCatalog("professions").find(
      (p) => p.id === withBonus.professionId
    );
    const mods = {
      race: (race?.derived_modifiers as Record<string, number>) || {},
      culture: (culture?.derived_modifiers as Record<string, number>) || {},
      profession: (profession?.derived_modifiers as Record<string, number>) || {},
    };
    recomputeDerived(withBonus, mods);
    // Run twice like wizard useEffect + import refresh
    recomputeDerived(withBonus, mods);
    const exportedBonus = exportLegacyHeldXml(withBonus);
    const m = exportedBonus.match(
      /BasiswertWert Basiswert="Basiswert\.Lebensenergie"[^>]*Bonus="(-?\d+)"/
    );
    check(
      "recomputeDerived preserves XML VP Bonus=5 across double refresh",
      m?.[1] === "5",
      m ? `Bonus=${m[1]}` : "no match"
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const exported = exportLegacyHeldXml(imported);
  const exportPath = path.join(OUT_DIR, "wulfgrimm-nexus-export.dcg");
  fs.writeFileSync(exportPath, exported, "utf8");
  console.log(`Wrote ${exportPath}`);

  check(
    "export has Variante attribute (not only child)",
    /SonderfertigkeitWert[^>]*Variante="Kulturkunde\.Mittelreich"/.test(exported)
  );
  check(
    "export has no child Variante element",
    !/<Variante\b/.test(exported)
  );
  check(
    "export always writes Zukauf on EigenschaftWert",
    /EigenschaftWert[^>]*Zukauf="0"/.test(exported)
  );
  check(
    "export always writes UnmodifizierteStufe",
    /TalentWert Talent="Talent\.Tanzen" UnmodifizierteStufe="0"/.test(exported)
  );
  check(
    "export writes Kapital",
    /<Kapital>4900<\/Kapital>/.test(exported)
  );
  check(
    "export writes melee Ini",
    /NahkampfwaffeWert[^>]*Ini="\d+"/.test(exported)
  );
  check(
    "export Kampf Attacke on Dolche",
    /TalentWert Talent="Talent\.Dolche"[^>]*Attacke=/.test(exported)
  );

  const roundtrip = importLegacyHeldXml(exported);
  const snapA = semanticSnapshot(imported);
  const snapB = semanticSnapshot(roundtrip);
  const diffs = diffPaths(snapA, snapB);
  if (diffs.length) {
    console.log("Semantic diffs (first 30):");
    for (const d of diffs.slice(0, 30)) console.log(`  ${d}`);
    fs.writeFileSync(
      path.join(OUT_DIR, "semantic-a.json"),
      JSON.stringify(snapA, null, 2)
    );
    fs.writeFileSync(
      path.join(OUT_DIR, "semantic-b.json"),
      JSON.stringify(snapB, null, 2)
    );
  }
  check("semantic round-trip", diffs.length === 0, `${diffs.length} diffs`);

  // Cosmetic note vs original (not a failure)
  const origLines = raw.split(/\r?\n/).length;
  const expLines = exported.split(/\r?\n/).length;
  console.log(
    `Note: original ${origLines} lines vs Nexus export ${expLines} lines (cosmetic; Java Out writes defaults).`
  );

  // Java probes
  const skipJava = process.env.SKIP_JAVA === "1";
  if (skipJava) {
    console.log("Skipping Java probe (SKIP_JAVA=1)");
  } else {
    const origProbe = runJavaProbe(FIXTURE, "original");
    check(
      "Java In rejects original Wulfgrimm (expected)",
      !origProbe.ok,
      origProbe.message
    );
    const nexusProbe = runJavaProbe(exportPath, "nexus-export");
    check(
      "Java In loads Nexus export",
      nexusProbe.ok,
      nexusProbe.message
    );
  }

  console.log(failures ? `\n${failures} failure(s)` : "\nAll checks passed.");
}

main();

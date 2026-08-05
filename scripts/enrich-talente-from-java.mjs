/**
 * One-shot enricher: merge Java Chargen Talent.java metadata into talente.json.
 * Run: node scripts/enrich-talente-from-java.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const talentPath = path.join(root, "lib/chargen/data/talente.json");

const E = (a, b, c, d) => {
  const attrs = [a, b, c, d].filter(Boolean).map((x) => `Eigenschaft.${x}`);
  return attrs;
};

/** id suffix → { test_attributes, complexity?, prerequisites? } */
const META = {
  // Combat — melee GE/GE/KK, ranged GE/FF/KK; KAMPFTECHNIK except Lanzenreiten
  Anderthalbhaender: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Armbrust: { test_attributes: E("GE", "FF", "KK") },
  Bogen: { test_attributes: E("GE", "FF", "KK"), prerequisites: ["NICHT_EINARMIG"] },
  Dolche: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Fechtwaffen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Hiebwaffen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Infanteriewaffen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Kettenwaffen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Lanzenreiten: { test_attributes: E("GE", "GE", "KK") },
  Raufen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Ringen: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Saebel: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Schwerter: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Speere: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Staebe: { test_attributes: E("GE", "GE", "KK"), prerequisites: ["KAMPFTECHNIK"] },
  Wurfbeile: { test_attributes: E("GE", "FF", "KK") },
  Wurfmesser: { test_attributes: E("GE", "FF", "KK") },
  Wurfspeere: { test_attributes: E("GE", "FF", "KK") },
  ZweihandHiebwaffen: {
    test_attributes: E("GE", "GE", "KK"),
    prerequisites: ["NICHT_EINARMIG", "KAMPFTECHNIK"],
  },
  Zweihandschwerter: {
    test_attributes: E("GE", "GE", "KK"),
    prerequisites: ["NICHT_EINARMIG", "KAMPFTECHNIK"],
  },
  // Body
  Akrobatik: {
    test_attributes: E("MU", "GE", "KK"),
    prerequisites: ["KOERPERBEHERRSCHUNG_4"],
  },
  Athletik: { test_attributes: E("GE", "KO", "KK") },
  Gaukeleien: { test_attributes: E("MU", "CH", "FF") },
  Klettern: { test_attributes: E("MU", "GE", "KK") },
  Koerperbeherrschung: { test_attributes: E("MU", "IN", "GE") },
  Reiten: { test_attributes: E("CH", "GE", "KK") },
  Schleichen: { test_attributes: E("MU", "IN", "GE") },
  Schwimmen: { test_attributes: E("GE", "KO", "KK") },
  Selbstbeherrschung: { test_attributes: E("MU", "KO", "KK") },
  SichVerstecken: { test_attributes: E("MU", "IN", "GE") },
  Singen: { test_attributes: E("IN", "CH", "KO") },
  Sinnenschaerfe: { test_attributes: E("KL", "IN", "IN", "FF") },
  StimmenImitieren: {
    test_attributes: E("KL", "IN", "CH"),
    prerequisites: ["SINNENSCHAERFE_4"],
  },
  Tanzen: { test_attributes: E("CH", "GE", "GE") },
  Taschendiebstahl: {
    test_attributes: E("MU", "IN", "FF"),
    prerequisites: ["MENSCHENKENNTNIS_4_STEIGERN"],
  },
  Zechen: { test_attributes: E("IN", "KO", "KK") },
  // Social
  Betoeren: {
    test_attributes: E("IN", "CH", "CH"),
    prerequisites: ["MENSCHENKENNTNIS_4"],
  },
  Etikette: { test_attributes: E("KL", "IN", "CH") },
  Gassenwissen: { test_attributes: E("KL", "IN", "CH") },
  Lehren: {
    test_attributes: E("KL", "IN", "CH"),
    prerequisites: ["MENSCHENKENNTNIS_4_STEIGERN"],
  },
  Menschenkenntnis: { test_attributes: E("KL", "IN", "CH") },
  SichVerkleiden: { test_attributes: E("MU", "CH", "GE") },
  Ueberreden: {
    test_attributes: E("MU", "IN", "CH"),
    prerequisites: ["MENSCHENKENNTNIS_4_STEIGERN"],
  },
  Ueberzeugen: { test_attributes: E("KL", "IN", "CH") },
  // Nature
  Faehrtensuchen: {
    test_attributes: E("KL", "IN", "KO", "IN"),
    prerequisites: ["SINNENSCHAERFE_4_STEIGERN"],
  },
  Fallenstellen: {
    test_attributes: E("KL", "FF", "KK"),
    prerequisites: ["WILDNISLEBEN_4_STEIGERN"],
  },
  FesselnEntfesseln: { test_attributes: E("FF", "GE", "KK") },
  FischenAngeln: { test_attributes: E("IN", "FF", "KK") },
  Orientierung: { test_attributes: E("KL", "IN", "IN") },
  Wettervorhersage: { test_attributes: E("KL", "IN", "IN") },
  Wildnisleben: { test_attributes: E("IN", "GE", "KO") },
  // Knowledge
  Anatomie: {
    test_attributes: E("MU", "KL", "FF"),
    prerequisites: ["NICHT_TOTENANGST"],
  },
  BrettWuerfelspiele: { test_attributes: E("KL", "KL", "IN") },
  Geographie: { test_attributes: E("KL", "KL", "IN") },
  Geschichtswissen: { test_attributes: E("KL", "KL", "IN") },
  Gesteinskunde: { test_attributes: E("KL", "IN", "FF") },
  GoetterKulte: { test_attributes: E("KL", "KL", "IN") },
  Heraldik: { test_attributes: E("KL", "KL", "FF") },
  Kriegskunst: { test_attributes: E("MU", "KL", "CH") },
  Magiekunde: {
    test_attributes: E("KL", "KL", "IN"),
    prerequisites: ["KULTURSPRACHE_6_STEIGERN"],
  },
  Mechanik: {
    test_attributes: E("KL", "KL", "FF"),
    prerequisites: ["SCHRIFT_6_STEIGERN", "RECHNEN_6_STEIGERN", "MALEN_ZEICHNEN_6_STEIGERN"],
  },
  Pflanzenkunde: { test_attributes: E("KL", "IN", "FF") },
  Rechnen: { test_attributes: E("KL", "KL", "IN") },
  Rechtskunde: { test_attributes: E("KL", "KL", "IN") },
  SagenLegenden: { test_attributes: E("KL", "IN", "CH") },
  Schaetzen: { test_attributes: E("KL", "IN", "IN") },
  Sprachenkunde: { test_attributes: E("KL", "KL", "IN") },
  Sternkunde: {
    test_attributes: E("KL", "KL", "IN"),
    prerequisites: [
      "GARETHI_TULAMIDYA_6_STEIGERN",
      "RECHNEN_6_STEIGERN",
      "SINNENSCHAERFE_6_STEIGERN",
    ],
  },
  Staatskunst: { test_attributes: E("KL", "IN", "CH") },
  Tierkunde: { test_attributes: E("MU", "KL", "IN") },
  // Languages (complexity from initialisiereSprache)
  Alaani: { test_attributes: E("KL", "IN", "CH"), complexity: 21 },
  Asdharia: { test_attributes: E("KL", "IN", "CH"), complexity: 24 },
  Atak: { test_attributes: E("KL", "IN", "CH"), complexity: 12 },
  Bosparano: { test_attributes: E("KL", "IN", "CH"), complexity: 21 },
  Fuechsisch: { test_attributes: E("KL", "IN", "CH"), complexity: 12 },
  Garethi: { test_attributes: E("KL", "IN", "CH"), complexity: 18 },
  Goblinisch: { test_attributes: E("KL", "IN", "CH"), complexity: 12 },
  Isdira: { test_attributes: E("KL", "IN", "CH"), complexity: 21 },
  Mohisch: { test_attributes: E("KL", "IN", "CH"), complexity: 15 },
  Nujuka: { test_attributes: E("KL", "IN", "CH"), complexity: 15 },
  Oloarkh: { test_attributes: E("KL", "IN", "CH"), complexity: 10 },
  Ologhaijan: { test_attributes: E("KL", "IN", "CH"), complexity: 15 },
  Rogolan: { test_attributes: E("KL", "IN", "CH"), complexity: 21 },
  Rssahh: { test_attributes: E("KL", "IN", "CH"), complexity: 18 },
  Thorwalsch: { test_attributes: E("KL", "IN", "CH"), complexity: 18 },
  Tulamidya: { test_attributes: E("KL", "IN", "CH"), complexity: 18 },
  UrTulamidya: { test_attributes: E("KL", "IN", "CH"), complexity: 21 },
  Zhayad: { test_attributes: E("KL", "IN", "CH"), complexity: 15 },
  // Scripts
  AsdhariaSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 18 },
  Chrmk: { test_attributes: E("KL", "KL", "FF"), complexity: 18 },
  GlyphenVonUnau: { test_attributes: E("KL", "KL", "FF"), complexity: 13 },
  HjaldingscheRunen: { test_attributes: E("KL", "KL", "FF"), complexity: 10 },
  IsdiraSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 15 },
  KuslikerZeichen: { test_attributes: E("KL", "KL", "FF"), complexity: 10 },
  Nanduria: { test_attributes: E("KL", "KL", "FF"), complexity: 10 },
  RogolanSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 11 },
  TulamidyaSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 14 },
  UrTulamidyaSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 16 },
  ZhayadSchrift: { test_attributes: E("KL", "KL", "FF"), complexity: 18 },
  // Craft
  Abrichten: {
    test_attributes: E("MU", "IN", "CH"),
    prerequisites: ["TIERKUNDE_4_STEIGERN"],
  },
  Ackerbau: { test_attributes: E("IN", "FF", "KO") },
  Alchimie: {
    test_attributes: E("MU", "KL", "FF"),
    prerequisites: ["SCHRIFT_4", "RECHNEN_4"],
  },
  Bergbau: {
    test_attributes: E("IN", "KO", "KK"),
    prerequisites: ["GESTEINSKUNDE_4"],
  },
  Bogenbau: {
    test_attributes: E("KL", "IN", "FF"),
    prerequisites: ["HOLZBEARBEITUNG_4"],
  },
  BooteFahren: { test_attributes: E("GE", "KO", "KK") },
  FahrzeugLenken: { test_attributes: E("IN", "CH", "FF") },
  Falschspiel: {
    test_attributes: E("MU", "CH", "FF"),
    prerequisites: ["MENSCHENKENNTNIS_4"],
  },
  Feinmechanik: {
    test_attributes: E("KL", "FF", "FF"),
    prerequisites: ["MALEN_ZEICHNEN_4"],
  },
  Fleischer: { test_attributes: E("KL", "FF", "KK") },
  GerberKuerschner: { test_attributes: E("KL", "FF", "KO") },
  Grobschmied: { test_attributes: E("FF", "KO", "KK") },
  HeilkundeGift: { test_attributes: E("MU", "KL", "IN") },
  HeilkundeKrankheiten: { test_attributes: E("MU", "KL", "CH") },
  HeilkundeSeele: { test_attributes: E("IN", "CH", "CH") },
  HeilkundeWunden: { test_attributes: E("KL", "CH", "FF") },
  Holzbearbeitung: { test_attributes: E("KL", "FF", "KK") },
  Kartographie: {
    test_attributes: E("KL", "KL", "FF"),
    prerequisites: ["MALEN_ZEICHNEN_4"],
  },
  Kochen: { test_attributes: E("KL", "IN", "FF") },
  Lederarbeiten: { test_attributes: E("KL", "FF", "FF") },
  MalenZeichnen: { test_attributes: E("KL", "IN", "FF") },
  Musizieren: { test_attributes: E("IN", "CH", "FF") },
  SchloesserKnacken: { test_attributes: E("IN", "FF", "FF") },
  Schneidern: { test_attributes: E("KL", "FF", "FF") },
  Seefahrt: { test_attributes: E("FF", "GE", "KK") },
  Steinmetz: {
    test_attributes: E("FF", "FF", "KK"),
    prerequisites: ["GESTEINSKUNDE_4"],
  },
  Steinschneider: {
    test_attributes: E("IN", "FF", "FF"),
    prerequisites: ["GESTEINSKUNDE_4_STEIGERN"],
  },
  Taetowieren: {
    test_attributes: E("IN", "FF", "FF"),
    prerequisites: ["MALEN_ZEICHNEN_4"],
  },
  Zimmermann: {
    test_attributes: E("KL", "FF", "KK"),
    prerequisites: ["HOLZBEARBEITUNG_4_STEIGERN"],
  },
  // Gifts
  Gefahreninstinkt: { test_attributes: E("KL", "IN", "IN") },
  Magiegespuer: { test_attributes: E("MU", "IN", "IN") },
  Prophezeien: { test_attributes: E("IN", "IN", "CH") },
  Zwergennase: { test_attributes: E("FF", "IN", "IN") },
  Ritualkenntnis: {
    test_attributes: E("KL"),
    prerequisites: ["NICHT_FREI_WAEHLBAR"],
  },
};

const talents = JSON.parse(fs.readFileSync(talentPath, "utf8"));
let enriched = 0;
for (const t of talents) {
  const suffix = String(t.id).replace(/^Talent\./, "");
  const meta = META[suffix];
  if (!meta) continue;
  if (meta.test_attributes) t.test_attributes = meta.test_attributes;
  if (meta.complexity != null) t.complexity = meta.complexity;
  if (meta.prerequisites?.length) t.prerequisites = meta.prerequisites;
  enriched++;
}
fs.writeFileSync(talentPath, JSON.stringify(talents, null, 2) + "\n");
console.log(`Enriched ${enriched}/${talents.length} talents in talente.json`);

/**
 * Fetches English spell text from tde4e.fandom.com (MediaWiki API) and
 * replaces stub descriptions ("See Liber Cantiones … full German …") where a matching
 * wiki page exists. (LC stubs are usually filled by extract-lc-stub-spells.py +
 * translate-lc-extracted.py from the local PDF.) Priority: German name (ASCII) + English name combo,
 * then German-only title, then id-based title.
 *
 * Usage: node scripts/enrich-spells-fandom.mjs [--all] [--dry-run] [--limit N]
 *   default: only entries whose description matches the LC stub pattern
 *   --all:    attempt fetch for every spell (overwrites existing descriptions)
 *
 * Respect Fandom: ~400ms minimum between API calls.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPELLS_PATH = path.join(__dirname, "..", "data", "magic", "spells.json");
const API =
  "https://tde4e.fandom.com/api.php?action=parse&prop=text&format=json";

const UA =
  "DSA_Nexus-spell-enricher/1.0 (educational; local codex; respects robots)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip common German diacritics for wiki title guesses. */
function deAsciiUpper(s) {
  const map = {
    ä: "ae",
    ö: "oe",
    ü: "ue",
    Ä: "Ae",
    Ö: "Oe",
    Ü: "Ue",
    ß: "ss",
  };
  let out = "";
  for (const ch of s) {
    out += map[ch] ?? ch;
  }
  return out.toUpperCase();
}

function isLcStub(desc) {
  return typeof desc === "string" && /see liber cantiones/i.test(desc);
}

function wikiTitleCandidates(spell) {
  const name = String(spell.name ?? "").trim();
  const gnRaw = String(spell.german_name ?? "").trim();
  const gn = deAsciiUpper(gnRaw);
  const idPart = String(spell.id ?? "")
    .split("_")
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const c = [];
  const nameU = name.toUpperCase();
  const gnOneWord = gn && !/\s/.test(gn);
  // Single-token Latin titles (e.g. SOMNIGRAVIS) usually match wiki page name directly.
  if (gnOneWord) c.push(gn);
  if (gn && name && gn !== nameU) c.push(`${gn} / ${name}`);
  if (gn && !gnOneWord) c.push(gn);
  if (name && gn !== nameU) c.push(name);
  if (idPart && !c.includes(idPart)) c.push(idPart);
  return [...new Set(c.filter(Boolean))];
}

function htmlToPlain(html) {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
  t = t
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  t = t.replace(/^[\s\n]*See also:\s*Liber Cantiones[\s\n]*/i, "").trim();
  return t;
}

async function fetchWikiBody(title) {
  const url = `${API}&page=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error?.code === "missingtitle") return null;
  if (data.error) throw new Error(data.error.info || JSON.stringify(data.error));
  const html = data.parse?.text?.["*"];
  if (!html || typeof html !== "string") return null;
  const plain = htmlToPlain(html);
  if (plain.length < 80) return null;
  return plain;
}

function clip(s, max = 5200) {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "\n\n[…]";
}

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry-run");
  const all = argv.includes("--all");
  const limArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limArg ? Number(limArg.split("=")[1]) : null;

  const raw = JSON.parse(fs.readFileSync(SPELLS_PATH, "utf8"));
  const spells = raw.spells;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < spells.length; i++) {
    const sp = spells[i];
    const desc = sp.description ?? "";
    if (!all && !isLcStub(desc)) {
      skipped++;
      continue;
    }
    if (limit != null && processed >= limit) break;
    processed++;

    const candidates = wikiTitleCandidates(sp);
    let body = null;
    let usedTitle = null;
    for (const title of candidates) {
      await sleep(420);
      try {
        body = await fetchWikiBody(title);
      } catch (e) {
        console.error(sp.id, title, e.message);
        failed++;
        body = null;
      }
      if (body) {
        usedTitle = title;
        break;
      }
    }

    if (body) {
      const next = clip(body);
      if (!dry) {
        sp.description = next;
        sp.description_source = `https://tde4e.fandom.com/wiki/${encodeURIComponent(usedTitle).replace(/%20/g, "_")}`;
      }
      console.log(`${dry ? "[dry] " : ""}OK ${sp.id} ← ${usedTitle} (${next.length} chars)`);
      updated++;
    } else {
      console.log(`— ${sp.id} (no wiki page; tried: ${candidates.join(" | ")})`);
    }
  }

  if (!dry && updated > 0) {
    raw.meta = raw.meta ?? {};
    raw.meta.last_updated = new Date().toISOString().slice(0, 10);
    raw.meta.description_enrichment =
      "English descriptions from tde4e.fandom.com (Liber Cantiones spell pages via MediaWiki API) where matched; unmatched stubs unchanged.";
    fs.writeFileSync(SPELLS_PATH, JSON.stringify(raw, null, 2) + "\n", "utf8");
  }

  console.log(
    JSON.stringify(
      { processed, updated, skipped, failed, dry },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

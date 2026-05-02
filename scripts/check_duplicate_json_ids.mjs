/**
 * Walk JSON files and report duplicate `id` values within the same array.
 * Usage: node scripts/check_duplicate_json_ids.mjs [dir]
 * Default dir: ./data  (repo root relative to script)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(
  __dirname,
  "..",
  process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : "data"
);

function walkDir(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walkDir(p, files);
    else if (name.isFile() && name.name.endsWith(".json")) files.push(p);
  }
  return files;
}

function idKey(v) {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  if (!("id" in v)) return null;
  const id = v.id;
  if (typeof id === "string") return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/** Returns list of { path, duplicates: Map<id, count> } */
function findDuplicateIdsInArrays(value, path = "$") {
  const issues = [];

  if (Array.isArray(value)) {
    const counts = new Map();
    for (const item of value) {
      const k = idKey(item);
      if (k != null) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = [...counts.entries()].filter(([, n]) => n > 1);
    if (dups.length) {
      issues.push({
        path,
        duplicates: Object.fromEntries(dups),
      });
    }
    value.forEach((child, i) => {
      issues.push(...findDuplicateIdsInArrays(child, `${path}[${i}]`));
    });
    return issues;
  }

  if (value != null && typeof value === "object") {
    for (const [k, child] of Object.entries(value)) {
      issues.push(...findDuplicateIdsInArrays(child, `${path}.${k}`));
    }
  }

  return issues;
}

const files = walkDir(root);
let totalIssues = 0;

for (const file of files.sort()) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    console.error(`SKIP (parse error): ${path.relative(root, file)} — ${e.message}`);
    continue;
  }
  const issues = findDuplicateIdsInArrays(data);
  if (issues.length === 0) continue;
  const rel = path.relative(path.join(__dirname, ".."), file).replace(/\\/g, "/");
  console.log(`\n${rel}`);
  for (const { path: p, duplicates } of issues) {
    console.log(`  ${p}`);
    console.log(`    duplicate ids: ${JSON.stringify(duplicates)}`);
    totalIssues += Object.keys(duplicates).length;
  }
}

const rootLabel = path.relative(path.join(__dirname, ".."), root).replace(/\\/g, "/") || ".";
if (totalIssues === 0) {
  console.log(`No duplicate ids found within any array under ${rootLabel}/`);
} else {
  console.log(
    `\nDone (${rootLabel}). Found ${totalIssues} duplicate id value(s) across array(s).`
  );
  process.exitCode = 1;
}

/**
 * Repair chargen_data.cultures rows whose AlleVon profession allow-lists were
 * imported empty (pre-fix XML parser). Copies professions from builtin JSON.
 *
 * Usage: npx tsx scripts/repair-culture-profession-filters.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getBuiltinCatalog } = await import(
    "../lib/chargen/data/builtinCatalog"
  );
  const { resolveCultureProfessionFilter } = await import(
    "../lib/chargen/rules/availability"
  );
  type CultureProfessionFilter = import("../lib/chargen/rules/availability").CultureProfessionFilter;
  const { db } = await import("../lib/db/client");
  const { chargenCultures } = await import("../lib/db/chargenSchema");

  const builtinById = new Map(
    getBuiltinCatalog("cultures").map((c) => [c.id, c])
  );
  const rows = await db.select().from(chargenCultures);
  let updated = 0;

  for (const row of rows) {
    const builtin = builtinById.get(row.entityId);
    if (!builtin) continue;
    const data =
      typeof row.data === "object" && row.data
        ? ({ ...(row.data as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    const resolved = resolveCultureProfessionFilter(
      data.professions as CultureProfessionFilter | undefined,
      builtin.professions as CultureProfessionFilter | undefined
    );
    if (
      !resolved ||
      JSON.stringify(resolved) === JSON.stringify(data.professions ?? null)
    ) {
      continue;
    }
    data.professions = resolved;
    await db
      .update(chargenCultures)
      .set({ data })
      .where(eq(chargenCultures.id, row.id));
    updated++;
    console.log("repaired", row.entityId, JSON.stringify(resolved));
  }

  console.log(`updated ${updated} of ${rows.length} culture rows`);

  const { loadCatalog } = await import("../lib/chargen/data/loadCatalog");
  const { isProfessionAllowedForCulture } = await import(
    "../lib/chargen/rules/availability"
  );
  const loaded = await loadCatalog("cultures");
  const c = loaded.items.find((x) => x.id === "Kultur.AuelfenHalbelf");
  console.log("verify professions", JSON.stringify(c?.professions));
  console.log(
    "Ranger",
    isProfessionAllowedForCulture(
      c as { professions?: CultureProfessionFilter },
      "Profession.Wildnislaeufer"
    )
  );
  console.log(
    "Legend Singer",
    isProfessionAllowedForCulture(
      c as { professions?: CultureProfessionFilter },
      "Profession.Legendensaenger"
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

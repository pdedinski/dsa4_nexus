/**
 * Custom/homebrew catalog tables for the Player Character Generator.
 * Lives in dedicated Postgres schema `chargen_data` (already exists in DB).
 * JSONB `data` mirrors entry shapes in lib/chargen/data/*.json.
 */

import {
  pgSchema,
  uuid,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema";

export const chargenDataSchema = pgSchema("chargen_data");

function catalogTable(name: string) {
  return chargenDataSchema.table(
    name,
    {
      id: uuid("id").primaryKey().defaultRandom(),
      entityId: text("entity_id").notNull(),
      data: jsonb("data").notNull(),
      createdBy: uuid("created_by").references(() => users.id, {
        onDelete: "set null",
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      notes: text("notes"),
    },
    (t) => [uniqueIndex(`${name}_entity_id_uidx`).on(t.entityId)]
  );
}

export const chargenRaces = catalogTable("races");
export const chargenCultures = catalogTable("cultures");
export const chargenProfessions = catalogTable("professions");
export const chargenMeleeWeapons = catalogTable("melee_weapons");
export const chargenRangedWeapons = catalogTable("ranged_weapons");
export const chargenArmor = catalogTable("armor");
export const chargenShields = catalogTable("shields");
export const chargenTalents = catalogTable("talents");
export const chargenSpells = catalogTable("spells");
export const chargenAdvantagesDisadvantages = catalogTable(
  "advantages_disadvantages"
);
export const chargenSpecialAbilities = catalogTable("special_abilities");

export const chargenCatalogTables = {
  races: chargenRaces,
  cultures: chargenCultures,
  professions: chargenProfessions,
  melee_weapons: chargenMeleeWeapons,
  ranged_weapons: chargenRangedWeapons,
  armor: chargenArmor,
  shields: chargenShields,
  talents: chargenTalents,
  spells: chargenSpells,
  advantages_disadvantages: chargenAdvantagesDisadvantages,
  special_abilities: chargenSpecialAbilities,
} as const;

export type ChargenCatalogTableName = keyof typeof chargenCatalogTables;

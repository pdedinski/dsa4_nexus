import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
  unique,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    googleSub: text("google_sub").notNull().unique(),
    email: text("email").unique(),
    displayName: text("display_name").notNull(),
    firstLoginAt: timestamp("first_login_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isAllowed: boolean("is_allowed").notNull().default(false),
    isEditor: boolean("is_editor").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false),
    isSuperuser: boolean("is_superuser").notNull().default(false),
    /** Persisted sidebar campaign selector; cleared if campaign is deleted. */
    selectedCampaignId: uuid("selected_campaign_id").references(
      (): AnyPgColumn => campaigns.id,
      { onDelete: "set null" }
    ),
  },
  (t) => [index("users_email_idx").on(t.email)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── codex_sources ─────────────────────────────────────────────────────────────
// One row per JSON file in /data. Seeded from manifest.json.

export const codexSources = pgTable(
  "codex_sources",
  {
    id: uuid("id").primaryKey(),
    category: text("category").notNull(),
    fileKey: text("file_key").notNull(),
    arrayKey: text("array_key").notNull(),
    label: text("label").notNull(),
  },
  (t) => [unique("codex_sources_cat_file").on(t.category, t.fileKey)]
);

export type CodexSource = typeof codexSources.$inferSelect;

// ── codex_entry_versions ──────────────────────────────────────────────────────
// Each row is one version of one entry in one source file.
// At most one row per (source_id, entry_id) may have is_default=true.
// Enforced by partial unique index created in migration SQL.

export const codexEntryVersions = pgTable(
  "codex_entry_versions",
  {
    id: uuid("id").primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => codexSources.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    versionLabel: text("version_label"),
    payload: jsonb("payload").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("cev_source_entry_idx").on(t.sourceId, t.entryId),
    index("cev_source_default_idx").on(t.sourceId, t.entryId, t.isDefault),
  ]
);

export type CodexEntryVersion = typeof codexEntryVersions.$inferSelect;
export type InsertCodexEntryVersion =
  typeof codexEntryVersions.$inferInsert;

// ── characters (saved PC sheets, per user) ───────────────────────────────────

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey(),
    characterId: text("character_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sheet: jsonb("sheet").notNull(),
    imageUrl: text("image_url"),
    imagePublicId: text("image_public_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("characters_user_cid").on(t.userId, t.characterId),
    index("characters_user_idx").on(t.userId),
  ]
);

export type CharacterRow = typeof characters.$inferSelect;
export type InsertCharacterRow = typeof characters.$inferInsert;

// ── notes (personal TipTap JSON per user) ─────────────────────────────────────

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notes_user_id_idx").on(t.userId)]
);

export type NoteRow = typeof notes.$inferSelect;
export type InsertNoteRow = typeof notes.$inferInsert;

// ── ap_spending_profiles (veteran AP spending presets, admin-managed) ──────────

export const apSpendingProfiles = pgTable(
  "ap_spending_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    bands: jsonb("bands").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ap_spending_profiles_created_at_idx").on(t.createdAt)]
);

export type ApSpendingProfileRow = typeof apSpendingProfiles.$inferSelect;
export type InsertApSpendingProfileRow =
  typeof apSpendingProfiles.$inferInsert;

// ── user_images (Cloudinary-backed uploads per user) ──────────────────────────

export const userImages = pgTable(
  "user_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    publicId: text("public_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("user_images_user_created_idx").on(t.userId, t.createdAt)]
);

export type UserImageRow = typeof userImages.$inferSelect;
export type InsertUserImageRow = typeof userImages.$inferInsert;

// ── campaigns (per-user role-playing campaign containers) ─────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("campaigns_user_id_idx").on(t.userId)]
);

export type CampaignRow = typeof campaigns.$inferSelect;
export type InsertCampaignRow = typeof campaigns.$inferInsert;

/** Polymorphic link: asset_type + asset_id points at characters / notes / user_images. */
export type CampaignAssetType = "character" | "note" | "image";

export const campaignAssets = pgTable(
  "campaign_assets",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    assetType: text("asset_type").notNull(),
    assetId: uuid("asset_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.assetType, t.assetId] }),
    index("campaign_assets_asset_idx").on(t.assetType, t.assetId),
  ]
);

export type CampaignAssetRow = typeof campaignAssets.$inferSelect;
export type InsertCampaignAssetRow = typeof campaignAssets.$inferInsert;

// ── combat tracker (one encounter per user) ───────────────────────────────────

export const combatEncounters = pgTable(
  "combat_encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    turnNumber: integer("turn_number").notNull().default(1),
    /** Current turn holder; follows combatant across reorders. */
    activeCombatantId: uuid("active_combatant_id").references(
      (): AnyPgColumn => combatCombatants.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("combat_encounters_user_unique").on(t.userId),
    index("combat_encounters_user_idx").on(t.userId),
  ]
);

export type CombatEncounterRow = typeof combatEncounters.$inferSelect;
export type InsertCombatEncounterRow = typeof combatEncounters.$inferInsert;

export const combatCombatants = pgTable(
  "combat_combatants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    encounterId: uuid("encounter_id")
      .notNull()
      .references(() => combatEncounters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ini: integer("ini").notNull().default(0),
    vp: integer("vp").notNull().default(0),
    asp: integer("asp").notNull().default(0),
    ar: integer("ar").notNull().default(0),
    comment: text("comment").notNull().default(""),
    /** Wound markers 0–6; each reduces effective INI by 2. */
    wounds: integer("wounds").notNull().default(0),
    /** True after this combatant has taken their action this round. */
    actionDone: boolean("action_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    lastDamageApplied: integer("last_damage_applied"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("combat_combatants_encounter_idx").on(t.encounterId, t.sortOrder),
  ]
);

export type CombatCombatantRow = typeof combatCombatants.$inferSelect;
export type InsertCombatCombatantRow = typeof combatCombatants.$inferInsert;

// ── app_settings (site-wide key/value config) ────────────────────────────────

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type AppSettingRow = typeof appSettings.$inferSelect;
export type InsertAppSettingRow = typeof appSettings.$inferInsert;


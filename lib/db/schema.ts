import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
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

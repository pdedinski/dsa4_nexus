-- DSA Nexus initial schema migration
-- Target PG version and constraints: ../POSTGRES.md
--
-- Designed for PostgreSQL 9.6.x (e.g. 9.6.22 on RHEL) without pgcrypto or uuid-ossp:
--   - No gen_random_uuid() / extension-backed UUID defaults (PG 9 has no built-in).
--   - JSONB and INSERT ... ON CONFLICT are available on 9.6.
--   - Application (Node) supplies UUIDs on insert; seed uses fixed UUID literals.

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY,
  google_sub     TEXT NOT NULL UNIQUE,
  email          TEXT UNIQUE,
  display_name   TEXT NOT NULL,
  first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_allowed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_editor      BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin       BOOLEAN NOT NULL DEFAULT FALSE,
  is_superuser   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ── codex_sources ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codex_sources (
  id         UUID PRIMARY KEY,
  category   TEXT NOT NULL,
  file_key   TEXT NOT NULL,
  array_key  TEXT NOT NULL,
  label      TEXT NOT NULL,
  UNIQUE (category, file_key)
);

-- ── codex_entry_versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codex_entry_versions (
  id             UUID PRIMARY KEY,
  source_id      UUID NOT NULL REFERENCES codex_sources(id) ON DELETE CASCADE,
  entry_id       TEXT NOT NULL,
  version_label  TEXT,
  payload        JSONB NOT NULL,
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS cev_source_entry_idx
  ON codex_entry_versions (source_id, entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS cev_one_default_per_entry
  ON codex_entry_versions (source_id, entry_id)
  WHERE is_default = TRUE;

-- ── seed codex_sources (fixed UUIDs; app resolves by category + file_key) ─────
INSERT INTO codex_sources (id, category, file_key, array_key, label) VALUES
  ('a0000001-0000-4000-8000-000000000001'::uuid, 'character',  'advantages',        'advantages',        'Advantages'),
  ('a0000001-0000-4000-8000-000000000002'::uuid, 'character',  'disadvantages',     'disadvantages',     'Disadvantages'),
  ('a0000001-0000-4000-8000-000000000003'::uuid, 'character',  'special_abilities', 'special_abilities', 'Special Abilities'),
  ('a0000001-0000-4000-8000-000000000004'::uuid, 'combat',     'combat_maneuvers',  'combat_maneuvers',  'Combat Maneuvers'),
  ('a0000001-0000-4000-8000-000000000005'::uuid, 'core',       'cultures',          'cultures',          'Cultures'),
  ('a0000001-0000-4000-8000-000000000006'::uuid, 'core',       'professions',       'professions',       'Professions'),
  ('a0000001-0000-4000-8000-000000000007'::uuid, 'core',       'races',             'races',             'Races'),
  ('a0000001-0000-4000-8000-000000000008'::uuid, 'equipment',  'armor',             'armor',             'Armor'),
  ('a0000001-0000-4000-8000-000000000009'::uuid, 'equipment',  'general_equipment', 'equipment',         'General Equipment'),
  ('a0000001-0000-4000-8000-00000000000a'::uuid, 'equipment',  'weapons',           'weapons',           'Weapons'),
  ('a0000001-0000-4000-8000-00000000000b'::uuid, 'magic',      'spells',            'spells',            'Spells'),
  ('a0000001-0000-4000-8000-00000000000c'::uuid, 'meta',       'advancement_costs', 'advancement_costs', 'Advancement Costs'),
  ('a0000001-0000-4000-8000-00000000000d'::uuid, 'talents',    'artisan_talents',   'talents',           'Artisan Talents'),
  ('a0000001-0000-4000-8000-00000000000e'::uuid, 'talents',    'combat_talents',    'talents',           'Combat Talents'),
  ('a0000001-0000-4000-8000-00000000000f'::uuid, 'talents',    'languages_scripts', 'talents',           'Languages & Scripts'),
  ('a0000001-0000-4000-8000-000000000010'::uuid, 'talents',    'lore_talents',      'talents',           'Lore Talents'),
  ('a0000001-0000-4000-8000-000000000011'::uuid, 'talents',    'nature_talents',    'talents',           'Nature Talents'),
  ('a0000001-0000-4000-8000-000000000012'::uuid, 'talents',    'physical_talents',  'talents',           'Physical Talents'),
  ('a0000001-0000-4000-8000-000000000013'::uuid, 'talents',    'social_talents',    'talents',           'Social Talents')
ON CONFLICT (category, file_key) DO NOTHING;

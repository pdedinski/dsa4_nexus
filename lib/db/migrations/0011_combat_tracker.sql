-- Per-user combat tracker (one encounter per user) + combatants
-- PG 14+: gen_random_uuid() is built-in (no extension required).

CREATE TABLE IF NOT EXISTS combat_encounters (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turn_number          INT NOT NULL DEFAULT 1,
  active_combatant_id  UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS combat_encounters_user_idx ON combat_encounters (user_id);

CREATE TABLE IF NOT EXISTS combat_combatants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id         UUID NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  ini                  INT NOT NULL DEFAULT 0,
  vp                   INT NOT NULL DEFAULT 0,
  asp                  INT NOT NULL DEFAULT 0,
  ar                   INT NOT NULL DEFAULT 0,
  sort_order           INT NOT NULL DEFAULT 0,
  last_damage_applied  INT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS combat_combatants_encounter_idx
  ON combat_combatants (encounter_id, sort_order);

-- Circular FK: active turn holder (cleared if combatant is deleted)
ALTER TABLE combat_encounters
  DROP CONSTRAINT IF EXISTS combat_encounters_active_combatant_fk;

ALTER TABLE combat_encounters
  ADD CONSTRAINT combat_encounters_active_combatant_fk
  FOREIGN KEY (active_combatant_id)
  REFERENCES combat_combatants(id)
  ON DELETE SET NULL;

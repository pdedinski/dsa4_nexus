-- Free-text comment on each combat tracker participant
ALTER TABLE combat_combatants
  ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT '';

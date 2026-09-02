-- Wound markers (0–6) and per-round action-done flag for combat tracker
ALTER TABLE combat_combatants
  ADD COLUMN IF NOT EXISTS wounds INT NOT NULL DEFAULT 0;

ALTER TABLE combat_combatants
  ADD COLUMN IF NOT EXISTS action_done BOOLEAN NOT NULL DEFAULT false;

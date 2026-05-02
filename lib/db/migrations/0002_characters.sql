-- Per-user saved character sheets (random generator + manual edits)

CREATE TABLE IF NOT EXISTS characters (
  id             UUID PRIMARY KEY,
  character_id   TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  sheet          JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, character_id)
);

CREATE INDEX IF NOT EXISTS characters_user_idx ON characters (user_id);

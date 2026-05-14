-- Veteran AP spending profile presets (admin-managed)
CREATE TABLE IF NOT EXISTS ap_spending_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  bands       JSONB NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ap_spending_profiles_created_at_idx
  ON ap_spending_profiles (created_at);

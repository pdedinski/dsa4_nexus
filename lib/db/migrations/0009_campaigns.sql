-- Role-playing campaigns (per user) + polymorphic campaign_assets junction
-- PG 14+: gen_random_uuid() is built-in (no extension required).

CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON campaigns(user_id);

CREATE TABLE IF NOT EXISTS campaign_assets (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  asset_type  TEXT NOT NULL,
  asset_id    UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, asset_type, asset_id),
  CONSTRAINT campaign_assets_type_check
    CHECK (asset_type IN ('character', 'note', 'image'))
);

CREATE INDEX IF NOT EXISTS campaign_assets_asset_idx
  ON campaign_assets (asset_type, asset_id);

-- Persisted per-user campaign selector (cleared if the campaign is deleted)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS selected_campaign_id UUID
  REFERENCES campaigns(id) ON DELETE SET NULL;

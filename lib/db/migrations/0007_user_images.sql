-- User-uploaded images (metadata; files stored on Cloudinary)
-- PG 14+: gen_random_uuid() is built-in (no extension required).

CREATE TABLE IF NOT EXISTS user_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  public_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_images_user_created_idx ON user_images(user_id, created_at);

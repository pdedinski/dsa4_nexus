-- Optional Cloudinary portrait per saved character (not in user_images)

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id TEXT;

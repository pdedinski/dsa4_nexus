ALTER TABLE "chargen_data"."heroes" ADD COLUMN IF NOT EXISTS "character_id" uuid;
--> statement-breakpoint
ALTER TABLE "chargen_data"."heroes" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "chargen_data"."heroes" SET "character_id" = "id" WHERE "character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "chargen_data"."heroes" ALTER COLUMN "character_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "heroes_character_version_uidx" ON "chargen_data"."heroes" USING btree ("character_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heroes_character_id_idx" ON "chargen_data"."heroes" USING btree ("character_id");

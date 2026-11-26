-- Modify "drafts" table
ALTER TABLE "public"."drafts" ADD COLUMN "placements_enabled" boolean NOT NULL DEFAULT false, ADD COLUMN "placements_released_at" timestamptz NULL;

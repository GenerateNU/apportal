-- Modify "applications" table
ALTER TABLE "public"."applications" ADD CONSTRAINT "applications_tag_ids_max" CHECK (cardinality(tag_ids) <= 3), ADD COLUMN "tag_ids" uuid[] NOT NULL DEFAULT '{}';
-- Create "cycle_tags" table
CREATE TABLE "public"."cycle_tags" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_cycle_tags_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "cycle_tags_cycle_id_name_key" to table: "cycle_tags"
CREATE UNIQUE INDEX "cycle_tags_cycle_id_name_key" ON "public"."cycle_tags" ("cycle_id", "name");

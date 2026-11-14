-- Create "branches" table
CREATE TABLE "public"."branches" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- Create index "branches_name_key" to table: "branches"
CREATE UNIQUE INDEX "branches_name_key" ON "public"."branches" ("name");
-- Existing cycles all belong to the Software branch
INSERT INTO "public"."branches" ("name") VALUES ('Software');
-- Modify "cycles" table
ALTER TABLE "public"."cycles" ADD COLUMN "branch_id" uuid NULL, ADD CONSTRAINT "fk_cycles_branch" FOREIGN KEY ("branch_id") REFERENCES "public"."branches" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
UPDATE "public"."cycles" SET "branch_id" = (SELECT "id" FROM "public"."branches" WHERE "name" = 'Software');
ALTER TABLE "public"."cycles" ALTER COLUMN "branch_id" SET NOT NULL;
-- Create index "idx_cycles_branch" to table: "cycles"
CREATE INDEX "idx_cycles_branch" ON "public"."cycles" ("branch_id");

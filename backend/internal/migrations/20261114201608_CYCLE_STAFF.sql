-- Create enum type "cycle_staff_role"
CREATE TYPE "public"."cycle_staff_role" AS ENUM ('lead', 'chief');
-- Create "cycle_staff" table
CREATE TABLE "public"."cycle_staff" (
  "cycle_id" uuid NOT NULL,
  "user_nuid" text NOT NULL,
  "role" "public"."cycle_staff_role" NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("cycle_id", "user_nuid"),
  CONSTRAINT "fk_cycle_staff_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "fk_cycle_staff_user" FOREIGN KEY ("user_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_cycle_staff_user" to table: "cycle_staff"
CREATE INDEX "idx_cycle_staff_user" ON "public"."cycle_staff" ("user_nuid");
-- Global leads and chiefs keep their access: staff on every existing cycle, at their highest role
INSERT INTO "public"."cycle_staff" ("cycle_id", "user_nuid", "role")
SELECT c.id, u.nuid, (CASE WHEN 'chief' = ANY (u.roles) THEN 'chief' ELSE 'lead' END)::"public"."cycle_staff_role"
FROM "public"."users" u CROSS JOIN "public"."cycles" c
WHERE u.roles && ARRAY['lead', 'chief']::"public"."user_role"[];
-- Rebuild "user_role" with only the global roles (Postgres can't drop enum values)
ALTER TYPE "public"."user_role" RENAME TO "user_role_old";
CREATE TYPE "public"."user_role" AS ENUM ('applicant', 'admin');
ALTER TABLE "public"."users" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "roles" TYPE "public"."user_role"[]
  USING array_remove(array_remove(array_remove("roles"::text[], 'member'), 'lead'), 'chief')::"public"."user_role"[];
UPDATE "public"."users" SET "roles" = '{applicant}' WHERE cardinality("roles") = 0;
ALTER TABLE "public"."users" ALTER COLUMN "roles" SET DEFAULT '{applicant}';
DROP TYPE "public"."user_role_old";

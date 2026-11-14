-- Create "roles" table
CREATE TABLE "public"."roles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_roles_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "roles_cycle_id_name_key" to table: "roles"
CREATE UNIQUE INDEX "roles_cycle_id_name_key" ON "public"."roles" ("cycle_id", "name");
-- Every Software cycle gets the two former enum roles, in their old order
INSERT INTO "public"."roles" ("cycle_id", "name", "created_at")
SELECT c.id, n.name, now() + n.ord * interval '1 microsecond'
FROM "public"."cycles" c
JOIN "public"."branches" b ON b.id = c.branch_id
CROSS JOIN (VALUES ('Software Engineer', 0), ('Software Designer', 1)) AS n(name, ord)
WHERE b.name = 'Software'
ON CONFLICT DO NOTHING;
-- Any other cycle gets whichever of them its data already uses
INSERT INTO "public"."roles" ("cycle_id", "name")
SELECT DISTINCT t.cycle_id, CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END
FROM (SELECT cycle_id, application_role FROM "public"."application_templates" UNION SELECT cycle_id, application_role FROM "public"."applications" UNION SELECT cycle_id, application_role FROM "public"."code_challenges" UNION SELECT cycle_id, application_role FROM "public"."decision_templates" UNION SELECT cycle_id, application_role FROM "public"."drafts" UNION SELECT cycle_id, application_role FROM "public"."interview_script" UNION SELECT cycle_id, application_role FROM "public"."preference_list_deadlines" UNION SELECT cycle_id, application_role FROM "public"."questions" WHERE application_role IS NOT NULL UNION SELECT cycle_id, application_role FROM "public"."review_questions" WHERE application_role IS NOT NULL UNION SELECT cycle_id, application_role FROM "public"."review_releases") AS t
ON CONFLICT DO NOTHING;
-- Backfill role_id on every table that carried application_role
ALTER TABLE "public"."application_templates" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."application_templates" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."application_templates" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."applications" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."applications" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."applications" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."code_challenges" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."code_challenges" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."code_challenges" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."decision_templates" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."decision_templates" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."decision_templates" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."drafts" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."drafts" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."drafts" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."interview_script" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."interview_script" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."interview_script" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."preference_list_deadlines" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."preference_list_deadlines" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."preference_list_deadlines" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "public"."questions" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."questions" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."review_questions" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."review_questions" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."review_releases" ADD COLUMN "role_id" uuid NULL;
UPDATE "public"."review_releases" AS t SET "role_id" = r.id
FROM "public"."roles" r
WHERE r.cycle_id = t.cycle_id AND r.name = CASE t.application_role WHEN 'software_engineer' THEN 'Software Engineer' WHEN 'software_designer' THEN 'Software Designer' END;
ALTER TABLE "public"."review_releases" ALTER COLUMN "role_id" SET NOT NULL;
-- Modify "application_templates" table
ALTER TABLE "public"."application_templates" DROP COLUMN "application_role", ADD CONSTRAINT "fk_application_templates_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "application_templates_cycle_id_role_id_key" to table: "application_templates"
CREATE UNIQUE INDEX "application_templates_cycle_id_role_id_key" ON "public"."application_templates" ("cycle_id", "role_id");
-- Drop index "applications_cycle_id_user_nuid_role_key" from table: "applications"
DROP INDEX "public"."applications_cycle_id_user_nuid_role_key";
-- Modify "applications" table
ALTER TABLE "public"."applications" DROP COLUMN "application_role", ADD CONSTRAINT "fk_applications_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "applications_cycle_id_user_nuid_role_key" to table: "applications"
CREATE UNIQUE INDEX "applications_cycle_id_user_nuid_role_key" ON "public"."applications" ("cycle_id", "user_nuid", "role_id");
-- Modify "code_challenges" table
ALTER TABLE "public"."code_challenges" DROP COLUMN "application_role", ADD CONSTRAINT "fk_code_challenges_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "decision_templates" table
ALTER TABLE "public"."decision_templates" DROP COLUMN "application_role", ADD CONSTRAINT "fk_decision_templates_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "decision_templates_cycle_id_role_id_kind_key" to table: "decision_templates"
CREATE UNIQUE INDEX "decision_templates_cycle_id_role_id_kind_key" ON "public"."decision_templates" ("cycle_id", "role_id", "kind");
-- Modify "drafts" table
ALTER TABLE "public"."drafts" DROP COLUMN "application_role", ADD CONSTRAINT "fk_drafts_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "drafts_cycle_id_role_id_key" to table: "drafts"
CREATE UNIQUE INDEX "drafts_cycle_id_role_id_key" ON "public"."drafts" ("cycle_id", "role_id");
-- Modify "interview_script" table
ALTER TABLE "public"."interview_script" DROP COLUMN "application_role", ADD CONSTRAINT "fk_interview_script_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "interview_script_cycle_id_role_id_key" to table: "interview_script"
CREATE UNIQUE INDEX "interview_script_cycle_id_role_id_key" ON "public"."interview_script" ("cycle_id", "role_id");
-- Modify "preference_list_deadlines" table
ALTER TABLE "public"."preference_list_deadlines" DROP COLUMN "application_role", ADD CONSTRAINT "fk_preference_list_deadlines_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "preference_list_deadlines_cycle_id_role_id_key" to table: "preference_list_deadlines"
CREATE UNIQUE INDEX "preference_list_deadlines_cycle_id_role_id_key" ON "public"."preference_list_deadlines" ("cycle_id", "role_id");
-- Drop index "idx_questions_cycle_role" from table: "questions"
DROP INDEX "public"."idx_questions_cycle_role";
-- Modify "questions" table
ALTER TABLE "public"."questions" DROP COLUMN "application_role", ADD CONSTRAINT "fk_questions_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "idx_questions_cycle_role" to table: "questions"
CREATE INDEX "idx_questions_cycle_role" ON "public"."questions" ("cycle_id", "role_id");
-- Modify "review_questions" table
ALTER TABLE "public"."review_questions" DROP COLUMN "application_role", ADD CONSTRAINT "fk_review_questions_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "review_releases" table
ALTER TABLE "public"."review_releases" DROP CONSTRAINT "review_releases_pkey", DROP COLUMN "application_role", ADD PRIMARY KEY ("cycle_id", "role_id", "review_kind"), ADD CONSTRAINT "fk_review_releases_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop enum type "application_role"
DROP TYPE "public"."application_role";

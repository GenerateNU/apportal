ALTER TABLE "public"."written_review_answers" DROP CONSTRAINT "written_review_answers_score_check";
ALTER TABLE "public"."review_questions" ADD COLUMN "score_min" integer NULL, ADD COLUMN "score_max" integer NULL, ADD COLUMN "ranked" boolean NOT NULL DEFAULT true;
UPDATE "public"."review_questions" SET "score_min" = 1, "score_max" = 10 WHERE "question_type" = 'score';
ALTER TABLE "public"."review_questions" ADD CONSTRAINT "review_questions_score_scale_check" CHECK (CASE WHEN question_type = 'score'::question_type THEN ((score_min IS NOT NULL) AND (score_max IS NOT NULL) AND (score_min < score_max)) ELSE ((score_min IS NULL) AND (score_max IS NULL)) END);
CREATE TABLE "public"."review_cutoffs" (
  "cycle_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "mode" text NOT NULL,
  "value" double precision NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("cycle_id", "role_id"),
  CONSTRAINT "fk_review_cutoffs_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_cutoffs_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "fk_review_cutoffs_updater" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "review_cutoffs_mode_check" CHECK (mode = ANY (ARRAY['min_score'::text, 'top_n'::text]))
);
CREATE TRIGGER "trg_review_cutoffs_updated_at" BEFORE UPDATE ON "public"."review_cutoffs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TABLE "public"."review_cutoff_overrides" (
  "application_id" uuid NOT NULL,
  "included" boolean NOT NULL,
  "set_by" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("application_id"),
  CONSTRAINT "fk_review_cutoff_overrides_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_cutoff_overrides_setter" FOREIGN KEY ("set_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE TRIGGER "trg_review_cutoff_overrides_updated_at" BEFORE UPDATE ON "public"."review_cutoff_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

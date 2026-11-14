CREATE TYPE "public"."review_rubric" AS ENUM ('score', 'category');

ALTER TABLE "public"."cycles"
  ADD COLUMN "review_rubric" "public"."review_rubric" NOT NULL DEFAULT 'score',
  ADD COLUMN "review_score_min" integer NOT NULL DEFAULT 1,
  ADD COLUMN "review_score_max" integer NOT NULL DEFAULT 5,
  ADD CONSTRAINT "cycles_review_score_range_check" CHECK (review_score_min < review_score_max);

UPDATE "public"."cycles" SET "review_score_max" = 10;

CREATE TABLE "public"."review_rubric_categories" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "label" text NOT NULL,
  "points" integer NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_review_rubric_categories_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "review_rubric_categories_cycle_id_label_key" ON "public"."review_rubric_categories" ("cycle_id", "label");

ALTER TABLE "public"."review_questions"
  ADD COLUMN "weight" numeric NOT NULL DEFAULT 1,
  ADD CONSTRAINT "review_questions_weight_check" CHECK (weight > 0);

ALTER TABLE "public"."written_review_answers"
  DROP CONSTRAINT "written_review_answers_score_check",
  ADD COLUMN "category_id" uuid NULL,
  ADD CONSTRAINT "fk_written_review_answers_category" FOREIGN KEY ("category_id") REFERENCES "public"."review_rubric_categories" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  ADD CONSTRAINT "written_review_answers_score_or_category_check" CHECK ((score IS NULL) OR (category_id IS NULL));

CREATE INDEX "idx_written_review_answers_category" ON "public"."written_review_answers" ("category_id");

CREATE TABLE "public"."review_scoring_settings" (
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "normalize" boolean NOT NULL DEFAULT false,
  "cutoff" numeric NULL,
  "updated_by" text NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("cycle_id", "application_role"),
  CONSTRAINT "fk_review_scoring_settings_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_scoring_settings_updater" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE TRIGGER "trg_review_scoring_settings_updated_at" BEFORE UPDATE ON "public"."review_scoring_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

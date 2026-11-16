-- Modify "written_review_answers" table
ALTER TABLE "public"."written_review_answers" DROP CONSTRAINT "written_review_answers_score_check";
-- Modify "review_questions" table
ALTER TABLE "public"."review_questions" ADD COLUMN "score_min" integer NULL, ADD COLUMN "score_max" integer NULL, ADD COLUMN "ranked" boolean NOT NULL DEFAULT true;
UPDATE "public"."review_questions" SET "score_min" = 1, "score_max" = 10 WHERE "question_type" = 'score';
ALTER TABLE "public"."review_questions" ADD CONSTRAINT "review_questions_score_scale_check" CHECK (CASE WHEN (question_type = 'score'::question_type) THEN ((score_min IS NOT NULL) AND (score_max IS NOT NULL) AND (score_min < score_max)) ELSE ((score_min IS NULL) AND (score_max IS NULL)) END);

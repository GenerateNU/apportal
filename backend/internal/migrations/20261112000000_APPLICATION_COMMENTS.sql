ALTER TABLE "public"."interview_comments" RENAME TO "application_comments";

ALTER TABLE "public"."application_comments" RENAME CONSTRAINT "interview_comments_pkey" TO "application_comments_pkey";

ALTER TABLE "public"."application_comments" RENAME CONSTRAINT "fk_interview_comments_application" TO "fk_application_comments_application";

ALTER TABLE "public"."application_comments" RENAME CONSTRAINT "fk_interview_comments_author" TO "fk_application_comments_author";

ALTER INDEX "public"."idx_interview_comments_app" RENAME TO "idx_application_comments_app";

ALTER TRIGGER "trg_interview_comments_updated_at" ON "public"."application_comments" RENAME TO "trg_application_comments_updated_at";

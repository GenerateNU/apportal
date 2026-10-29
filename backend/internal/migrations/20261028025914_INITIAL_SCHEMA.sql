-- Create enum type "application_role"
CREATE TYPE "public"."application_role" AS ENUM ('software_engineer', 'software_designer');
-- Create enum type "application_stage"
CREATE TYPE "public"."application_stage" AS ENUM ('draft', 'submitted', 'lead_review', 'chief_review', 'interview', 'interview_scheduled', 'interview_conducted', 'interview_review', 'selection', 'accepted', 'rejected', 'withdrawn');
-- Create enum type "application_type"
CREATE TYPE "public"."application_type" AS ENUM ('member', 'lead', 'chief');
-- Create enum type "cycle_status"
CREATE TYPE "public"."cycle_status" AS ENUM ('draft', 'open', 'closed', 'archived');
-- Create enum type "decision_kind"
CREATE TYPE "public"."decision_kind" AS ENUM ('rejection_post_interview', 'rejection_generic');
-- Create enum type "interview_rating"
CREATE TYPE "public"."interview_rating" AS ENUM ('do_not_hire', 'good', 'great', 'must_hire', 'neutral');
-- Create enum type "question_type"
CREATE TYPE "public"."question_type" AS ENUM ('short_answer', 'long_answer', 'multiple_choice', 'checkbox', 'url', 'dropdown', 'score');
-- Create enum type "user_role"
CREATE TYPE "public"."user_role" AS ENUM ('applicant', 'member', 'lead', 'chief', 'admin');
-- Create "cycles" table
CREATE TABLE "public"."cycles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "status" "public"."cycle_status" NOT NULL DEFAULT 'draft',
  "application_type" "public"."application_type" NOT NULL DEFAULT 'member',
  "opens_at" timestamptz NULL,
  "closes_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- Create "application_templates" table
CREATE TABLE "public"."application_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "title" text NOT NULL,
  "description" text NULL,
  "instructions" text NULL,
  "opens_at" timestamptz NULL,
  "closes_at" timestamptz NULL,
  "status" "public"."cycle_status" NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "review_status" "public"."cycle_status" NOT NULL DEFAULT 'draft',
  "review_closes_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_application_templates_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "application_templates_cycle_id_application_role_key" to table: "application_templates"
CREATE UNIQUE INDEX "application_templates_cycle_id_application_role_key" ON "public"."application_templates" ("cycle_id", "application_role");
-- Create "users" table
CREATE TABLE "public"."users" (
  "nuid" text NOT NULL,
  "email" text NOT NULL,
  "full_name" text NOT NULL,
  "roles" "public"."user_role"[] NOT NULL DEFAULT '{applicant}',
  "graduation_year" integer NULL,
  "major" text NULL,
  "github_username" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "returner" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("nuid")
);
-- Create index "idx_users_roles" to table: "users"
CREATE INDEX "idx_users_roles" ON "public"."users" USING GIN ("roles");
-- Create index "users_email_key" to table: "users"
CREATE UNIQUE INDEX "users_email_key" ON "public"."users" ("email");
-- Create "applications" table
CREATE TABLE "public"."applications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "user_nuid" text NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "stage" "public"."application_stage" NOT NULL DEFAULT 'draft',
  "availability" jsonb NULL,
  "resume_url" text NULL,
  "submitted_at" timestamptz NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_applications_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_applications_user" FOREIGN KEY ("user_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "applications_cycle_id_user_nuid_role_key" to table: "applications"
CREATE UNIQUE INDEX "applications_cycle_id_user_nuid_role_key" ON "public"."applications" ("cycle_id", "user_nuid", "application_role");
-- Create index "idx_applications_cycle" to table: "applications"
CREATE INDEX "idx_applications_cycle" ON "public"."applications" ("cycle_id");
-- Create index "idx_applications_stage" to table: "applications"
CREATE INDEX "idx_applications_stage" ON "public"."applications" ("stage");
-- Create index "idx_applications_user" to table: "applications"
CREATE INDEX "idx_applications_user" ON "public"."applications" ("user_nuid");
-- Create "chief_review_comments" table
CREATE TABLE "public"."chief_review_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "author_nuid" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_chief_review_comments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_chief_review_comments_author" FOREIGN KEY ("author_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_chief_review_comments_app" to table: "chief_review_comments"
CREATE INDEX "idx_chief_review_comments_app" ON "public"."chief_review_comments" ("application_id");
-- Create "chief_reviews" table
CREATE TABLE "public"."chief_reviews" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "reviewer_nuid" text NOT NULL,
  "vote" text NULL,
  "decided_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_chief_reviews_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_chief_reviews_reviewer" FOREIGN KEY ("reviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "chief_reviews_vote_check" CHECK (vote = ANY (ARRAY['strong_interview'::text, 'interview'::text, 'neutral'::text, 'no_interview'::text, 'strong_no_interview'::text]))
);
-- Create index "chief_reviews_application_id_reviewer_nuid_key" to table: "chief_reviews"
CREATE UNIQUE INDEX "chief_reviews_application_id_reviewer_nuid_key" ON "public"."chief_reviews" ("application_id", "reviewer_nuid");
-- Create index "idx_chief_reviews_app" to table: "chief_reviews"
CREATE INDEX "idx_chief_reviews_app" ON "public"."chief_reviews" ("application_id");
-- Create "code_challenges" table
CREATE TABLE "public"."code_challenges" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "name" text NOT NULL,
  "challenge_url" text NULL,
  "instructions" text NULL,
  "due_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_code_challenges_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "code_submissions" table
CREATE TABLE "public"."code_submissions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "challenge_id" uuid NOT NULL,
  "submission_url" text NOT NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "raw_score" numeric NULL,
  "score_details" jsonb NULL,
  "score_updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_code_submissions_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_code_submissions_challenge" FOREIGN KEY ("challenge_id") REFERENCES "public"."code_challenges" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "code_submissions_application_id_challenge_id_key" to table: "code_submissions"
CREATE UNIQUE INDEX "code_submissions_application_id_challenge_id_key" ON "public"."code_submissions" ("application_id", "challenge_id");
-- Create index "idx_code_submissions_app" to table: "code_submissions"
CREATE INDEX "idx_code_submissions_app" ON "public"."code_submissions" ("application_id");
-- Create "cycle_stages" table
CREATE TABLE "public"."cycle_stages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "stage" "public"."application_stage" NOT NULL,
  "display_order" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "required_assignments" integer NOT NULL DEFAULT 0,
  "label" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_cycle_stages_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "cycle_stages_cycle_id_stage_key" to table: "cycle_stages"
CREATE UNIQUE INDEX "cycle_stages_cycle_id_stage_key" ON "public"."cycle_stages" ("cycle_id", "stage");
-- Create index "idx_cycle_stages_cycle" to table: "cycle_stages"
CREATE INDEX "idx_cycle_stages_cycle" ON "public"."cycle_stages" ("cycle_id");
-- Create "decision_drafts" table
CREATE TABLE "public"."decision_drafts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "kind" "public"."decision_kind" NOT NULL,
  "feedback" text NULL,
  "compliments" text NULL,
  "body_override" text NULL,
  "author_nuid" text NULL,
  "sent_at" timestamptz NULL,
  "sent_by" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "previous_stage" "public"."application_stage" NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_decision_drafts_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_decision_drafts_author" FOREIGN KEY ("author_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_decision_drafts_sender" FOREIGN KEY ("sent_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "decision_drafts_application_id_key" to table: "decision_drafts"
CREATE UNIQUE INDEX "decision_drafts_application_id_key" ON "public"."decision_drafts" ("application_id");
-- Create "decision_templates" table
CREATE TABLE "public"."decision_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "kind" "public"."decision_kind" NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_decision_templates_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_decision_templates_updated_by_user" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "decision_templates_cycle_id_application_role_kind_key" to table: "decision_templates"
CREATE UNIQUE INDEX "decision_templates_cycle_id_application_role_kind_key" ON "public"."decision_templates" ("cycle_id", "application_role", "kind");
-- Create "drafts" table
CREATE TABLE "public"."drafts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "status" text NOT NULL DEFAULT 'setup',
  "rounds" integer NOT NULL DEFAULT 1,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_drafts_creator" FOREIGN KEY ("created_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_drafts_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "drafts_rounds_check" CHECK (rounds > 0),
  CONSTRAINT "drafts_status_check" CHECK (status = ANY (ARRAY['setup'::text, 'active'::text, 'complete'::text]))
);
-- Create index "drafts_cycle_id_application_role_key" to table: "drafts"
CREATE UNIQUE INDEX "drafts_cycle_id_application_role_key" ON "public"."drafts" ("cycle_id", "application_role");
-- Create "preference_lists" table
CREATE TABLE "public"."preference_lists" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "created_by" text NOT NULL,
  "submitted_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "meeting_day" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_lists_creator" FOREIGN KEY ("created_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_preference_lists_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "preference_lists_meeting_day_check" CHECK (meeting_day = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text])),
  CONSTRAINT "preference_lists_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text]))
);
-- Create index "idx_preference_lists_cycle" to table: "preference_lists"
CREATE INDEX "idx_preference_lists_cycle" ON "public"."preference_lists" ("cycle_id");
-- Create "draft_teams" table
CREATE TABLE "public"."draft_teams" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL,
  "preference_list_id" uuid NOT NULL,
  "position" integer NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_draft_teams_draft" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_draft_teams_preference_list" FOREIGN KEY ("preference_list_id") REFERENCES "public"."preference_lists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "draft_teams_draft_id_preference_list_id_key" to table: "draft_teams"
CREATE UNIQUE INDEX "draft_teams_draft_id_preference_list_id_key" ON "public"."draft_teams" ("draft_id", "preference_list_id");
-- Create index "idx_draft_teams_draft" to table: "draft_teams"
CREATE INDEX "idx_draft_teams_draft" ON "public"."draft_teams" ("draft_id", "position");
-- Create "draft_picks" table
CREATE TABLE "public"."draft_picks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "draft_id" uuid NOT NULL,
  "pick_number" integer NOT NULL,
  "draft_team_id" uuid NOT NULL,
  "application_id" uuid NOT NULL,
  "previous_stage" "public"."application_stage" NOT NULL,
  "picked_by" text NOT NULL,
  "picked_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_draft_picks_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_draft_picks_draft" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_draft_picks_draft_team" FOREIGN KEY ("draft_team_id") REFERENCES "public"."draft_teams" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_draft_picks_picker" FOREIGN KEY ("picked_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "draft_picks_pick_number_check" CHECK (pick_number > 0)
);
-- Create index "draft_picks_draft_id_application_id_key" to table: "draft_picks"
CREATE UNIQUE INDEX "draft_picks_draft_id_application_id_key" ON "public"."draft_picks" ("draft_id", "application_id");
-- Create index "draft_picks_draft_id_pick_number_key" to table: "draft_picks"
CREATE UNIQUE INDEX "draft_picks_draft_id_pick_number_key" ON "public"."draft_picks" ("draft_id", "pick_number");
-- Create index "idx_draft_picks_application" to table: "draft_picks"
CREATE INDEX "idx_draft_picks_application" ON "public"."draft_picks" ("application_id");
-- Create index "idx_draft_picks_draft" to table: "draft_picks"
CREATE INDEX "idx_draft_picks_draft" ON "public"."draft_picks" ("draft_id", "pick_number");
-- Create "interview_assignments" table
CREATE TABLE "public"."interview_assignments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "assigned_by" text NOT NULL,
  "interviewer_nuid" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_assignments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_assignments_assigner" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_interview_assignments_interviewer" FOREIGN KEY ("interviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_interview_assignments_app" to table: "interview_assignments"
CREATE INDEX "idx_interview_assignments_app" ON "public"."interview_assignments" ("application_id");
-- Create index "idx_interview_assignments_interviewer" to table: "interview_assignments"
CREATE INDEX "idx_interview_assignments_interviewer" ON "public"."interview_assignments" ("interviewer_nuid");
-- Create index "interview_assignments_application_id_key" to table: "interview_assignments"
CREATE UNIQUE INDEX "interview_assignments_application_id_key" ON "public"."interview_assignments" ("application_id");
-- Create "interview_comments" table
CREATE TABLE "public"."interview_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "author_nuid" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_comments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_comments_author" FOREIGN KEY ("author_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_interview_comments_app" to table: "interview_comments"
CREATE INDEX "idx_interview_comments_app" ON "public"."interview_comments" ("application_id");
-- Create "interviews" table
CREATE TABLE "public"."interviews" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "interviewer_nuid" text NOT NULL,
  "scheduled_at" timestamptz NULL,
  "conducted_at" timestamptz NULL,
  "recording_url" text NULL,
  "notes_url" text NULL,
  "comments" text NULL,
  "rating" "public"."interview_rating" NULL,
  "submitted_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interviews_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interviews_interviewer" FOREIGN KEY ("interviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_interviews_app" to table: "interviews"
CREATE INDEX "idx_interviews_app" ON "public"."interviews" ("application_id");
-- Create index "interviews_application_id_key" to table: "interviews"
CREATE UNIQUE INDEX "interviews_application_id_key" ON "public"."interviews" ("application_id");
-- Set comment to column: "notes_url" on table: "interviews"
COMMENT ON COLUMN "public"."interviews"."notes_url" IS 'link to the interviewer''s notes doc (e.g. Granola)';
-- Create "interview_recording_reviews" table
CREATE TABLE "public"."interview_recording_reviews" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "interview_id" uuid NOT NULL,
  "reviewer_nuid" text NOT NULL,
  "comments" text NULL,
  "rating" "public"."interview_rating" NULL,
  "submitted_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_recording_reviews_interview" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_recording_reviews_reviewer" FOREIGN KEY ("reviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_recording_reviews_inter" to table: "interview_recording_reviews"
CREATE INDEX "idx_recording_reviews_inter" ON "public"."interview_recording_reviews" ("interview_id");
-- Create index "interview_recording_reviews_interview_id_reviewer_nuid_key" to table: "interview_recording_reviews"
CREATE UNIQUE INDEX "interview_recording_reviews_interview_id_reviewer_nuid_key" ON "public"."interview_recording_reviews" ("interview_id", "reviewer_nuid");
-- Create "interview_review_assignments" table
CREATE TABLE "public"."interview_review_assignments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "lead_nuid" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_review_assignments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_review_assignments_assigner" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_interview_review_assignments_lead" FOREIGN KEY ("lead_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_interview_rev_assign_app" to table: "interview_review_assignments"
CREATE INDEX "idx_interview_rev_assign_app" ON "public"."interview_review_assignments" ("application_id");
-- Create index "interview_review_assignments_application_id_tl_nuid_key" to table: "interview_review_assignments"
CREATE UNIQUE INDEX "interview_review_assignments_application_id_tl_nuid_key" ON "public"."interview_review_assignments" ("application_id", "lead_nuid");
-- Create "interview_script" table
CREATE TABLE "public"."interview_script" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "intro_speech" text NOT NULL,
  "recording_reminder" text NOT NULL,
  "questions" jsonb NOT NULL,
  "closing_note" text NOT NULL,
  "challenge_intro" text NOT NULL,
  "challenge_tracks" jsonb NOT NULL,
  "post_interview_checklist" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_script_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_script_updated_by_user" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "interview_script_cycle_id_application_role_key" to table: "interview_script"
CREATE UNIQUE INDEX "interview_script_cycle_id_application_role_key" ON "public"."interview_script" ("cycle_id", "application_role");
-- Create "lead_assignments" table
CREATE TABLE "public"."lead_assignments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "lead_nuid" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_lead_assignments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_lead_assignments_assigner" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_lead_assignments_lead" FOREIGN KEY ("lead_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_lead_assignments_app" to table: "lead_assignments"
CREATE INDEX "idx_lead_assignments_app" ON "public"."lead_assignments" ("application_id");
-- Create index "idx_lead_assignments_lead" to table: "lead_assignments"
CREATE INDEX "idx_lead_assignments_lead" ON "public"."lead_assignments" ("lead_nuid");
-- Create index "tl_assignments_application_id_tl_nuid_key" to table: "lead_assignments"
CREATE UNIQUE INDEX "tl_assignments_application_id_tl_nuid_key" ON "public"."lead_assignments" ("application_id", "lead_nuid");
-- Create "lead_selections" table
CREATE TABLE "public"."lead_selections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "lead_nuid" text NOT NULL,
  "application_id" uuid NOT NULL,
  "note" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_lead_selections_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_lead_selections_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_lead_selections_lead" FOREIGN KEY ("lead_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_lead_selections_app" to table: "lead_selections"
CREATE INDEX "idx_lead_selections_app" ON "public"."lead_selections" ("application_id");
-- Create index "idx_lead_selections_cycle_lead" to table: "lead_selections"
CREATE INDEX "idx_lead_selections_cycle_lead" ON "public"."lead_selections" ("cycle_id", "lead_nuid");
-- Create index "tl_selections_cycle_id_tl_nuid_application_id_key" to table: "lead_selections"
CREATE UNIQUE INDEX "tl_selections_cycle_id_tl_nuid_application_id_key" ON "public"."lead_selections" ("cycle_id", "lead_nuid", "application_id");
-- Create "preference_list_comments" table
CREATE TABLE "public"."preference_list_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "preference_list_id" uuid NOT NULL,
  "application_id" uuid NULL,
  "author_nuid" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_list_comments_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_preference_list_comments_author" FOREIGN KEY ("author_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_preference_list_comments_preference_list" FOREIGN KEY ("preference_list_id") REFERENCES "public"."preference_lists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_preference_list_comments_list" to table: "preference_list_comments"
CREATE INDEX "idx_preference_list_comments_list" ON "public"."preference_list_comments" ("preference_list_id");
-- Create "preference_list_deadlines" table
CREATE TABLE "public"."preference_list_deadlines" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "closes_at" timestamptz NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_list_deadlines_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_preference_list_deadlines_updated_by_user" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "preference_list_deadlines_cycle_id_application_role_key" to table: "preference_list_deadlines"
CREATE UNIQUE INDEX "preference_list_deadlines_cycle_id_application_role_key" ON "public"."preference_list_deadlines" ("cycle_id", "application_role");
-- Create "preference_list_entries" table
CREATE TABLE "public"."preference_list_entries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "preference_list_id" uuid NOT NULL,
  "application_id" uuid NOT NULL,
  "rank" integer NOT NULL,
  "reasoning" text NULL,
  "updated_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_list_entries_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_preference_list_entries_preference_list" FOREIGN KEY ("preference_list_id") REFERENCES "public"."preference_lists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_preference_list_entries_updater" FOREIGN KEY ("updated_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_preference_list_entries_list" to table: "preference_list_entries"
CREATE INDEX "idx_preference_list_entries_list" ON "public"."preference_list_entries" ("preference_list_id");
-- Create index "preference_list_entries_preference_list_id_application_id_key" to table: "preference_list_entries"
CREATE UNIQUE INDEX "preference_list_entries_preference_list_id_application_id_key" ON "public"."preference_list_entries" ("preference_list_id", "application_id");
-- Create "preference_list_members" table
CREATE TABLE "public"."preference_list_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "preference_list_id" uuid NOT NULL,
  "lead_nuid" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_list_members_adder" FOREIGN KEY ("added_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_preference_list_members_lead" FOREIGN KEY ("lead_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_preference_list_members_preference_list" FOREIGN KEY ("preference_list_id") REFERENCES "public"."preference_lists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_preference_list_members_lead" to table: "preference_list_members"
CREATE INDEX "idx_preference_list_members_lead" ON "public"."preference_list_members" ("lead_nuid");
-- Create index "preference_list_members_preference_list_id_lead_nuid_key" to table: "preference_list_members"
CREATE UNIQUE INDEX "preference_list_members_preference_list_id_lead_nuid_key" ON "public"."preference_list_members" ("preference_list_id", "lead_nuid");
-- Create "preference_list_personal_entries" table
CREATE TABLE "public"."preference_list_personal_entries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "preference_list_id" uuid NOT NULL,
  "owner_nuid" text NOT NULL,
  "application_id" uuid NOT NULL,
  "rank" integer NOT NULL,
  "reasoning" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_preference_list_personal_entries_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_preference_list_personal_entries_owner" FOREIGN KEY ("owner_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_preference_list_personal_entries_preference_list" FOREIGN KEY ("preference_list_id") REFERENCES "public"."preference_lists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_preference_list_personal_entries_list_owner" to table: "preference_list_personal_entries"
CREATE INDEX "idx_preference_list_personal_entries_list_owner" ON "public"."preference_list_personal_entries" ("preference_list_id", "owner_nuid");
-- Create index "preference_list_personal_entr_preference_list_id_owner_nuid_key" to table: "preference_list_personal_entries"
CREATE UNIQUE INDEX "preference_list_personal_entr_preference_list_id_owner_nuid_key" ON "public"."preference_list_personal_entries" ("preference_list_id", "owner_nuid", "application_id");
-- Create "questions" table
CREATE TABLE "public"."questions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NULL,
  "question_text" text NOT NULL,
  "question_type" "public"."question_type" NOT NULL DEFAULT 'long_answer',
  "is_required" boolean NOT NULL DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,
  "options" jsonb NULL,
  "page_title" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_questions_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "idx_questions_cycle_role" to table: "questions"
CREATE INDEX "idx_questions_cycle_role" ON "public"."questions" ("cycle_id", "application_role");
-- Create "review_questions" table
CREATE TABLE "public"."review_questions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NULL,
  "question_text" text NOT NULL,
  "question_type" "public"."question_type" NOT NULL DEFAULT 'long_answer',
  "is_required" boolean NOT NULL DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,
  "options" jsonb NULL,
  "description" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_review_questions_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create "review_releases" table
CREATE TABLE "public"."review_releases" (
  "cycle_id" uuid NOT NULL,
  "application_role" "public"."application_role" NOT NULL,
  "review_kind" text NOT NULL,
  "released_by" text NOT NULL,
  "released_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("cycle_id", "application_role", "review_kind"),
  CONSTRAINT "fk_review_releases_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_review_releases_releaser" FOREIGN KEY ("released_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "review_releases_review_kind_check" CHECK (review_kind = ANY (ARRAY['written'::text, 'recording'::text]))
);
-- Create "written_answers" table
CREATE TABLE "public"."written_answers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "answer_text" text NULL,
  "answer_options" jsonb NULL,
  "answer_file_path" text NULL,
  "answer_file_name" text NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_written_answers_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_written_answers_question" FOREIGN KEY ("question_id") REFERENCES "public"."questions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_written_answers_app" to table: "written_answers"
CREATE INDEX "idx_written_answers_app" ON "public"."written_answers" ("application_id");
-- Create index "written_answers_application_id_question_id_key" to table: "written_answers"
CREATE UNIQUE INDEX "written_answers_application_id_question_id_key" ON "public"."written_answers" ("application_id", "question_id");
-- Create "written_reviews" table
CREATE TABLE "public"."written_reviews" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "reviewer_nuid" text NOT NULL,
  "submitted_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_written_reviews_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_written_reviews_reviewer" FOREIGN KEY ("reviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "idx_written_reviews_app" to table: "written_reviews"
CREATE INDEX "idx_written_reviews_app" ON "public"."written_reviews" ("application_id");
-- Create index "written_reviews_application_id_reviewer_nuid_key" to table: "written_reviews"
CREATE UNIQUE INDEX "written_reviews_application_id_reviewer_nuid_key" ON "public"."written_reviews" ("application_id", "reviewer_nuid");
-- Create "written_review_answers" table
CREATE TABLE "public"."written_review_answers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "review_id" uuid NOT NULL,
  "review_question_id" uuid NOT NULL,
  "answer_text" text NULL,
  "answer_options" jsonb NULL,
  "score" integer NULL,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_written_review_answers_review" FOREIGN KEY ("review_id") REFERENCES "public"."written_reviews" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_written_review_answers_review_question" FOREIGN KEY ("review_question_id") REFERENCES "public"."review_questions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "written_review_answers_score_check" CHECK ((score >= 1) AND (score <= 10))
);
-- Create index "written_review_answers_review_id_review_question_id_key" to table: "written_review_answers"
CREATE UNIQUE INDEX "written_review_answers_review_id_review_question_id_key" ON "public"."written_review_answers" ("review_id", "review_question_id");
-- Create function "set_updated_at"
CREATE FUNCTION "public"."set_updated_at"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
-- Create trigger "trg_application_templates_updated_at"
CREATE TRIGGER "trg_application_templates_updated_at" BEFORE UPDATE ON "public"."application_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_applications_updated_at"
CREATE TRIGGER "trg_applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_chief_review_comments_updated_at"
CREATE TRIGGER "trg_chief_review_comments_updated_at" BEFORE UPDATE ON "public"."chief_review_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_chief_reviews_updated_at"
CREATE TRIGGER "trg_chief_reviews_updated_at" BEFORE UPDATE ON "public"."chief_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_decision_drafts_updated_at"
CREATE TRIGGER "trg_decision_drafts_updated_at" BEFORE UPDATE ON "public"."decision_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_decision_templates_updated_at"
CREATE TRIGGER "trg_decision_templates_updated_at" BEFORE UPDATE ON "public"."decision_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_drafts_updated_at"
CREATE TRIGGER "trg_drafts_updated_at" BEFORE UPDATE ON "public"."drafts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_interview_comments_updated_at"
CREATE TRIGGER "trg_interview_comments_updated_at" BEFORE UPDATE ON "public"."interview_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_recording_reviews_updated_at"
CREATE TRIGGER "trg_recording_reviews_updated_at" BEFORE UPDATE ON "public"."interview_recording_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_interview_script_updated_at"
CREATE TRIGGER "trg_interview_script_updated_at" BEFORE UPDATE ON "public"."interview_script" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_interviews_updated_at"
CREATE TRIGGER "trg_interviews_updated_at" BEFORE UPDATE ON "public"."interviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_lead_selections_updated_at"
CREATE TRIGGER "trg_lead_selections_updated_at" BEFORE UPDATE ON "public"."lead_selections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_preference_list_comments_updated_at"
CREATE TRIGGER "trg_preference_list_comments_updated_at" BEFORE UPDATE ON "public"."preference_list_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_preference_list_deadlines_updated_at"
CREATE TRIGGER "trg_preference_list_deadlines_updated_at" BEFORE UPDATE ON "public"."preference_list_deadlines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_preference_list_entries_updated_at"
CREATE TRIGGER "trg_preference_list_entries_updated_at" BEFORE UPDATE ON "public"."preference_list_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_preference_list_personal_entries_updated_at"
CREATE TRIGGER "trg_preference_list_personal_entries_updated_at" BEFORE UPDATE ON "public"."preference_list_personal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_preference_lists_updated_at"
CREATE TRIGGER "trg_preference_lists_updated_at" BEFORE UPDATE ON "public"."preference_lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_users_updated_at"
CREATE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
-- Create trigger "trg_written_reviews_updated_at"
CREATE TRIGGER "trg_written_reviews_updated_at" BEFORE UPDATE ON "public"."written_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

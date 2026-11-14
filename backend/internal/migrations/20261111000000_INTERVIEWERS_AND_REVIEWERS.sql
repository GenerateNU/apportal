CREATE TABLE "public"."interviewers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "interview_id" uuid NOT NULL,
  "interviewer_nuid" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interviewers_assigner" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_interviewers_interview" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interviewers_user" FOREIGN KEY ("interviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX "idx_interviewers_interviewer" ON "public"."interviewers" ("interviewer_nuid");

CREATE UNIQUE INDEX "interviewers_interview_id_interviewer_nuid_key" ON "public"."interviewers" ("interview_id", "interviewer_nuid");

CREATE TABLE "public"."interview_reviewers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "interview_id" uuid NOT NULL,
  "reviewer_nuid" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  "writeup" text NULL,
  "writeup_submitted_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_interview_reviewers_assigner" FOREIGN KEY ("assigned_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_interview_reviewers_interview" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_interview_reviewers_reviewer" FOREIGN KEY ("reviewer_nuid") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX "idx_interview_reviewers_reviewer" ON "public"."interview_reviewers" ("reviewer_nuid");

CREATE UNIQUE INDEX "interview_reviewers_interview_id_reviewer_nuid_key" ON "public"."interview_reviewers" ("interview_id", "reviewer_nuid");

DROP TABLE "public"."interview_recording_reviews";

DROP TABLE "public"."interview_review_assignments";

DROP TABLE "public"."interview_assignments";

ALTER TABLE "public"."interviews" DROP COLUMN "interviewer_nuid", DROP COLUMN "comments", ADD COLUMN "writeup" text NULL;

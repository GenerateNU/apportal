CREATE TABLE "public"."cycle_steps" (
  "cycle_id" uuid NOT NULL,
  "step" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "completed_at" timestamptz NULL,
  PRIMARY KEY ("cycle_id", "step"),
  CONSTRAINT "fk_cycle_steps_cycle" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "cycle_steps_step_check" CHECK (step IN ('applications','reviews','interviews','decisions','feedback'))
);
CREATE TABLE "public"."step_assignments" (
  "cycle_id" uuid NOT NULL,
  "step" text NOT NULL,
  "kind" text NOT NULL,
  "per_applicant" integer NOT NULL,
  PRIMARY KEY ("cycle_id", "step", "kind"),
  CONSTRAINT "fk_cycle_steps_assignments" FOREIGN KEY ("cycle_id", "step") REFERENCES "public"."cycle_steps" ("cycle_id", "step") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "step_assignments_kind_check" CHECK (kind IN ('reviewer','interviewer','recording_reviewer')),
  CONSTRAINT "step_assignments_per_applicant_check" CHECK (per_applicant > 0)
);
CREATE TABLE "public"."opening_steps" (
  "cycle_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "step" text NOT NULL,
  "released_at" timestamptz NULL,
  "released_by" text NULL,
  PRIMARY KEY ("cycle_id", "role_id", "step"),
  CONSTRAINT "fk_cycle_steps_openings" FOREIGN KEY ("cycle_id", "step") REFERENCES "public"."cycle_steps" ("cycle_id", "step") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_opening_steps_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_opening_steps_releaser" FOREIGN KEY ("released_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE TABLE "public"."opening_deadlines" (
  "cycle_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "step" text NOT NULL,
  "kind" text NOT NULL,
  "due_at" timestamptz NOT NULL,
  "hard" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("cycle_id", "role_id", "step", "kind"),
  CONSTRAINT "fk_cycle_steps_deadlines" FOREIGN KEY ("cycle_id", "step") REFERENCES "public"."cycle_steps" ("cycle_id", "step") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_opening_deadlines_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "opening_deadlines_kind_check" CHECK (kind IN ('applicant','reviewer','interviewer','recording_reviewer'))
);
CREATE TABLE "public"."application_moves" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "seq" bigserial NOT NULL,
  "batch_id" uuid NOT NULL,
  "application_id" uuid NOT NULL,
  "from_stage" "public"."application_stage" NOT NULL,
  "to_stage" "public"."application_stage" NOT NULL,
  "moved_by" text NOT NULL,
  "moved_at" timestamptz NOT NULL DEFAULT now(),
  "undone_at" timestamptz NULL,
  "undone_by" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_application_moves_application" FOREIGN KEY ("application_id") REFERENCES "public"."applications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_application_moves_mover" FOREIGN KEY ("moved_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_application_moves_undoer" FOREIGN KEY ("undone_by") REFERENCES "public"."users" ("nuid") ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE INDEX "idx_application_moves_app" ON "public"."application_moves" ("application_id");
CREATE INDEX "idx_application_moves_batch" ON "public"."application_moves" ("batch_id");
INSERT INTO "public"."cycle_steps" ("cycle_id", "step", "enabled")
SELECT c.id, s.step,
  CASE
    WHEN s.step = 'applications' THEN true
    WHEN s.step = 'feedback' THEN NOT EXISTS (SELECT 1 FROM "public"."cycle_stages" cs WHERE cs.cycle_id = c.id AND cs.stage::text = 'feedback' AND NOT cs.is_active)
    WHEN NOT EXISTS (SELECT 1 FROM "public"."cycle_stages" cs WHERE cs.cycle_id = c.id) THEN true
    ELSE EXISTS (SELECT 1 FROM "public"."cycle_stages" cs WHERE cs.cycle_id = c.id AND cs.stage::text = s.stage AND cs.is_active)
  END
FROM "public"."cycles" c
CROSS JOIN (VALUES ('applications', 'submitted'), ('reviews', 'lead_review'), ('interviews', 'interview'), ('decisions', 'selection'), ('feedback', 'feedback')) AS s (step, stage);
INSERT INTO "public"."step_assignments" ("cycle_id", "step", "kind", "per_applicant")
SELECT cs.cycle_id, 'reviews', 'reviewer', cs.required_assignments
FROM "public"."cycle_stages" cs WHERE cs.stage::text = 'lead_review' AND cs.required_assignments > 0;
INSERT INTO "public"."step_assignments" ("cycle_id", "step", "kind", "per_applicant")
SELECT cs.cycle_id, 'interviews', 'interviewer', cs.required_assignments
FROM "public"."cycle_stages" cs WHERE cs.stage::text = 'interview' AND cs.required_assignments > 0;
INSERT INTO "public"."step_assignments" ("cycle_id", "step", "kind", "per_applicant")
SELECT cs.cycle_id, 'interviews', 'recording_reviewer', GREATEST(cs.required_assignments, 1)
FROM "public"."cycle_stages" cs WHERE cs.stage::text = 'interview_review' AND cs.is_active;
INSERT INTO "public"."opening_steps" ("cycle_id", "role_id", "step", "released_at")
SELECT t.cycle_id, t.role_id, 'applications', COALESCE(t.opens_at, t.created_at)
FROM "public"."application_templates" t WHERE t.status <> 'draft';
INSERT INTO "public"."opening_steps" ("cycle_id", "role_id", "step", "released_at")
SELECT t.cycle_id, t.role_id, 'reviews', t.updated_at
FROM "public"."application_templates" t WHERE t.review_status IN ('open', 'closed');
INSERT INTO "public"."opening_deadlines" ("cycle_id", "role_id", "step", "kind", "due_at", "hard")
SELECT t.cycle_id, t.role_id, 'applications', 'applicant',
  CASE WHEN t.status IN ('closed', 'archived') AND (t.closes_at IS NULL OR t.closes_at > now()) THEN now() ELSE t.closes_at END, true
FROM "public"."application_templates" t
WHERE t.closes_at IS NOT NULL OR t.status IN ('closed', 'archived');
INSERT INTO "public"."opening_deadlines" ("cycle_id", "role_id", "step", "kind", "due_at", "hard")
SELECT t.cycle_id, t.role_id, 'reviews', 'reviewer',
  CASE WHEN t.review_status IN ('closed', 'archived') AND (t.review_closes_at IS NULL OR t.review_closes_at > now()) THEN now() ELSE t.review_closes_at END, false
FROM "public"."application_templates" t
WHERE t.review_closes_at IS NOT NULL OR t.review_status IN ('closed', 'archived');
DROP TABLE "public"."cycle_stages";
ALTER TABLE "public"."application_templates" DROP COLUMN "opens_at", DROP COLUMN "closes_at", DROP COLUMN "status", DROP COLUMN "review_status", DROP COLUMN "review_closes_at";

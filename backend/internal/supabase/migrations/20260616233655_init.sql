CREATE TYPE role AS ENUM (
  'software_engineer',
  'software_designer'
);

CREATE TYPE application_stage AS ENUM (
  'submitted',            -- applicant has submitted
  'tl_review',            -- assigned to 3 TLs for written review
  'chief_review',         -- chiefs reviewing TL scores, deciding interview invites
  'interview_scheduled',  -- invited; interview not yet conducted
  'interview_conducted',  -- interviewer has left notes; assigned reviewers watching recording
  'interview_review',     -- assigned TLs reviewing the recording
  'selection',            -- all TLs reviewing all interviews, choosing their team
  'accepted',
  'rejected',
  'withdrawn'
);

CREATE TYPE reviewer_role AS ENUM (
  'tl',
  'chief'
);

-- Written review: numeric 1–10
-- Interview review: qualitative
CREATE TYPE interview_rating AS ENUM (
  'do_not_hire',
  'good',
  'great',
  'must_hire'
);

CREATE TYPE question_type AS ENUM (
  'short_answer',
  'long_answer',
  'multiple_choice',
  'checkbox',
  'url'           -- e.g. GitHub repo link, portfolio
);

CREATE TYPE cycle_status AS ENUM (
  'draft',
  'open',
  'closed',
  'archived'
);


-- ============================================================
--  USERS (members / staff who log in and review)
--  NUID is the PK per spec
-- ============================================================

CREATE TABLE users (
  nuid              TEXT        PRIMARY KEY,           -- Northeastern NUID
  email             TEXT        NOT NULL UNIQUE,
  full_name         TEXT        NOT NULL,
  reviewer_role     reviewer_role,                     -- NULL if not a reviewer
  github_username   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  APPLICATION CYCLES
--  One cycle per semester (e.g. "Fall 2026")
-- ============================================================

CREATE TABLE cycles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,                    -- e.g. "Fall 2026"
  status      cycle_status NOT NULL DEFAULT 'draft',
  opens_at    TIMESTAMPTZ,
  closes_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  QUESTIONS
--  Injectable per cycle; tied to a role or global (role IS NULL)
-- ============================================================

CREATE TABLE questions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id      UUID          NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  role          role,                                  -- NULL = shown to all roles
  question_text TEXT          NOT NULL,
  question_type question_type NOT NULL DEFAULT 'long_answer',
  is_required   BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order INT           NOT NULL DEFAULT 0,
  options       JSONB,                                 -- for multiple_choice / checkbox
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ============================================================
--  APPLICANTS
--  Separate from users — external people applying
--  NUID is PK per spec
-- ============================================================

CREATE TABLE applicants (
  nuid            TEXT        PRIMARY KEY,
  email           TEXT        NOT NULL UNIQUE,
  full_name       TEXT        NOT NULL,
  github_username TEXT,
  graduation_year INT,
  major           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
--  APPLICATIONS
--  One row per applicant × role × cycle
-- ============================================================

CREATE TABLE applications (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID             NOT NULL REFERENCES cycles(id),
  applicant_nuid  TEXT             NOT NULL REFERENCES applicants(nuid),
  role            role             NOT NULL,
  stage           application_stage NOT NULL DEFAULT 'submitted',

  -- Availability collected at submission time
  availability    JSONB,           -- e.g. { "mon_am": true, "tue_pm": false, ... }

  resume_url      TEXT,            -- Storage URL (Supabase Storage bucket)
  submitted_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  UNIQUE (cycle_id, applicant_nuid, role)
);


-- ============================================================
--  WRITTEN ANSWERS
--  One row per question per application
-- ============================================================

CREATE TABLE written_answers (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question_id     UUID  NOT NULL REFERENCES questions(id),
  answer_text     TEXT,
  answer_options  JSONB,           -- for checkbox / multiple choice responses
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, question_id)
);


-- ============================================================
--  CODE CHALLENGE SUBMISSIONS
--  GitHub-based; scores populated externally (deferred per spec)
-- ============================================================

CREATE TABLE code_challenges (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID  NOT NULL REFERENCES cycles(id),
  role            role  NOT NULL,
  name            TEXT  NOT NULL,   -- e.g. "Backend Challenge 1"
  github_repo_url TEXT,             -- template repo to fork
  instructions    TEXT,
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE code_submissions (
  id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  challenge_id      UUID  NOT NULL REFERENCES code_challenges(id),
  github_repo_url   TEXT  NOT NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Score fields intentionally loose for now (deferred)
  -- Populate via webhook / external job when scores land
  raw_score         NUMERIC,
  score_details     JSONB,          -- test case breakdown etc. TBD
  score_updated_at  TIMESTAMPTZ,

  UNIQUE (application_id, challenge_id)
);


-- ============================================================
--  TL REVIEW ASSIGNMENTS
--  Chiefs assign TLs to written apps
-- ============================================================

CREATE TABLE tl_assignments (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tl_nuid         TEXT  NOT NULL REFERENCES users(nuid),
  assigned_by     TEXT  NOT NULL REFERENCES users(nuid),  -- chief who assigned
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, tl_nuid)
);


-- ============================================================
--  WRITTEN REVIEWS  (TL stage)
--  Score 1–10 + reasoning per answer + overall
-- ============================================================

CREATE TABLE written_reviews (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_nuid   TEXT  NOT NULL REFERENCES users(nuid),

  overall_score   INT   CHECK (overall_score BETWEEN 1 AND 10),
  reasoning       TEXT, -- overall written reasoning

  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, reviewer_nuid)
);

-- Per-answer scores within a written review
CREATE TABLE written_review_answer_scores (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID  NOT NULL REFERENCES written_reviews(id) ON DELETE CASCADE,
  answer_id       UUID  NOT NULL REFERENCES written_answers(id) ON DELETE CASCADE,
  score           INT   CHECK (score BETWEEN 1 AND 10),
  comment         TEXT,

  UNIQUE (review_id, answer_id)
);


-- ============================================================
--  CHIEF REVIEW  (after TL reviews, before interview decision)
-- ============================================================

CREATE TABLE chief_reviews (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_nuid   TEXT  NOT NULL REFERENCES users(nuid),
  notes           TEXT,
  advance_to_interview BOOLEAN,     -- NULL = undecided, TRUE/FALSE = decided
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, reviewer_nuid)
);


-- ============================================================
--  INTERVIEW ASSIGNMENTS
--  Chiefs assign one interviewer (TL or Chief) per interview,
--  plus 2 TLs to review the recording afterward
-- ============================================================

CREATE TABLE interview_assignments (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  assigned_by     TEXT  NOT NULL REFERENCES users(nuid),  -- chief who assigned
  interviewer_nuid TEXT NOT NULL REFERENCES users(nuid),  -- conducts the interview
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id)  -- one interviewer per application
);

-- Chiefs assign 2 TLs to watch the recording and leave comments
CREATE TABLE interview_review_assignments (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tl_nuid         TEXT  NOT NULL REFERENCES users(nuid),
  assigned_by     TEXT  NOT NULL REFERENCES users(nuid),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, tl_nuid)
);


-- ============================================================
--  INTERVIEWS
--  Interviewer fills this out after conducting the interview
-- ============================================================

CREATE TABLE interviews (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_nuid TEXT NOT NULL REFERENCES users(nuid),
  scheduled_at    TIMESTAMPTZ,
  conducted_at    TIMESTAMPTZ,
  recording_url   TEXT,            -- embed link (Notion, Loom, etc.)
  notes           TEXT,            -- interviewer's notes from the session
  comments        TEXT,            -- interviewer's overall comments
  rating          interview_rating,-- interviewer gives the rating
  submitted_at    TIMESTAMPTZ,     -- NULL until interviewer finalises
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id)          -- one interview record per application
);


-- ============================================================
--  INTERVIEW RECORDING REVIEWS
--  The 2 assigned TLs watch the recording and leave comments.
--  All TLs can also view (handled at app layer via RLS/policy),
--  but only assigned ones submit a formal review.
-- ============================================================

CREATE TABLE interview_recording_reviews (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    UUID             NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  reviewer_nuid   TEXT             NOT NULL REFERENCES users(nuid),
  comments        TEXT,
  rating          interview_rating,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (interview_id, reviewer_nuid)
);


-- ============================================================
--  TL SELECTIONS  (draft / final pick stage)
--  After all interviews are in, every TL marks who they want.
--  Chiefs use this to make final accept/reject decisions.
-- ============================================================

CREATE TABLE tl_selections (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID  NOT NULL REFERENCES cycles(id),
  tl_nuid         TEXT  NOT NULL REFERENCES users(nuid),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  note            TEXT,            -- optional reasoning
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (cycle_id, tl_nuid, application_id)
);


-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX idx_applications_cycle        ON applications(cycle_id);
CREATE INDEX idx_applications_applicant    ON applications(applicant_nuid);
CREATE INDEX idx_applications_stage        ON applications(stage);
CREATE INDEX idx_written_answers_app       ON written_answers(application_id);
CREATE INDEX idx_written_reviews_app       ON written_reviews(application_id);
CREATE INDEX idx_tl_assignments_tl         ON tl_assignments(tl_nuid);
CREATE INDEX idx_tl_assignments_app        ON tl_assignments(application_id);
CREATE INDEX idx_chief_reviews_app         ON chief_reviews(application_id);
CREATE INDEX idx_interview_assignments_app ON interview_assignments(application_id);
CREATE INDEX idx_interview_rev_assign_app  ON interview_review_assignments(application_id);
CREATE INDEX idx_interviews_app            ON interviews(application_id);
CREATE INDEX idx_recording_reviews_inter   ON interview_recording_reviews(interview_id);
CREATE INDEX idx_tl_selections_cycle_tl    ON tl_selections(cycle_id, tl_nuid);
CREATE INDEX idx_tl_selections_app         ON tl_selections(application_id);
CREATE INDEX idx_code_submissions_app      ON code_submissions(application_id);
CREATE INDEX idx_questions_cycle_role      ON questions(cycle_id, role);


-- ============================================================
--  updated_at TRIGGER  (apply to all tables that have it)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_applicants_updated_at
  BEFORE UPDATE ON applicants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_written_reviews_updated_at
  BEFORE UPDATE ON written_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chief_reviews_updated_at
  BEFORE UPDATE ON chief_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recording_reviews_updated_at
  BEFORE UPDATE ON interview_recording_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tl_selections_updated_at
  BEFORE UPDATE ON tl_selections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
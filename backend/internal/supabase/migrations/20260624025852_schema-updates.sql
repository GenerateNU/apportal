-- ============================================================
--  MIGRATION: v2 → v3
--  Brings the already-pushed schema up to date with:
--    1. tl → lead (enums, tables, columns)
--    2. applicants merged into users (single entity)
--    3. Option B flow templates (application_type + cycle_stages)
-- ============================================================


-- ============================================================
--  1. ENUMS
-- ============================================================

-- 1a. Add new user_role enum (replaces reviewer_role)
CREATE TYPE user_role AS ENUM (
  'applicant',
  'member',
  'lead',
  'chief',
  'admin'
);

-- 1b. Add application_type enum
CREATE TYPE application_type AS ENUM (
  'member',
  'lead',
  'chief',
);

-- 1c. Rename application_stage values: tl_review → lead_review
--     Postgres requires renaming enum values one at a time
ALTER TYPE application_stage RENAME VALUE 'tl_review' TO 'lead_review';

-- 1d. Drop old reviewer_role enum (after we migrate users below)
--     Done after column is dropped in step 2


-- ============================================================
--  2. USERS — add new columns, drop reviewer_role
-- ============================================================

-- Add roles array (replaces reviewer_role scalar)
ALTER TABLE users
  ADD COLUMN roles user_role[] NOT NULL DEFAULT '{applicant}';

-- Migrate existing reviewer_role values into the new roles array
UPDATE users SET roles = '{lead}'  WHERE reviewer_role = 'tl';
UPDATE users SET roles = '{chief}' WHERE reviewer_role = 'chief';

-- Add applicant profile fields (were on applicants table)
ALTER TABLE users
  ADD COLUMN graduation_year INT,
  ADD COLUMN major           TEXT;

-- Drop old reviewer_role column then the enum
ALTER TABLE users DROP COLUMN reviewer_role;
DROP TYPE reviewer_role;


-- ============================================================
--  3. MERGE applicants INTO users
-- ============================================================

-- Copy any applicant rows that don't already exist in users
INSERT INTO users (nuid, email, full_name, github_username, graduation_year, major, created_at, updated_at)
SELECT nuid, email, full_name, github_username, graduation_year, major, created_at, updated_at
FROM applicants
ON CONFLICT (nuid) DO UPDATE SET
  graduation_year = EXCLUDED.graduation_year,
  major           = EXCLUDED.major,
  github_username = COALESCE(users.github_username, EXCLUDED.github_username);

-- Re-point applications.applicant_nuid → users.nuid
ALTER TABLE applications
  DROP CONSTRAINT applications_applicant_nuid_fkey;

ALTER TABLE applications
  RENAME COLUMN applicant_nuid TO user_nuid;

ALTER TABLE applications
  ADD CONSTRAINT applications_user_nuid_fkey
  FOREIGN KEY (user_nuid) REFERENCES users(nuid);

-- Update the unique constraint to use the new column name
ALTER TABLE applications
  DROP CONSTRAINT applications_cycle_id_applicant_nuid_role_key;

ALTER TABLE applications
  ADD CONSTRAINT applications_cycle_id_user_nuid_role_key
  UNIQUE (cycle_id, user_nuid, application_role);

-- Drop applicants table
DROP TABLE applicants;

-- Drop now-stale trigger
DROP TRIGGER IF EXISTS trg_applicants_updated_at ON applicants;


-- ============================================================
--  4. RENAME role → application_role
--     (avoids collision with user_role and SQL reserved words)
-- ============================================================

ALTER TYPE role RENAME TO application_role;

ALTER TABLE applications
  RENAME COLUMN role TO application_role;

ALTER TABLE questions
  RENAME COLUMN role TO application_role;

ALTER TABLE code_challenges
  RENAME COLUMN role TO application_role;


-- ============================================================
--  5. tl → lead: TABLES AND COLUMNS
-- ============================================================

-- 5a. tl_assignments → lead_assignments
ALTER TABLE tl_assignments RENAME TO lead_assignments;
ALTER TABLE lead_assignments RENAME COLUMN tl_nuid TO lead_nuid;

ALTER INDEX idx_tl_assignments_tl  RENAME TO idx_lead_assignments_lead;
ALTER INDEX idx_tl_assignments_app RENAME TO idx_lead_assignments_app;

-- 5b. interview_review_assignments: tl_nuid → lead_nuid
ALTER TABLE interview_review_assignments
  RENAME COLUMN tl_nuid TO lead_nuid;

-- 5c. tl_selections → lead_selections
ALTER TABLE tl_selections RENAME TO lead_selections;
ALTER TABLE lead_selections RENAME COLUMN tl_nuid TO lead_nuid;

ALTER INDEX idx_tl_selections_cycle_tl RENAME TO idx_lead_selections_cycle_lead;
ALTER INDEX idx_tl_selections_app      RENAME TO idx_lead_selections_app;

-- 5d. Drop old trigger on tl_selections, add for lead_selections
DROP TRIGGER IF EXISTS trg_tl_selections_updated_at ON tl_selections;

CREATE TRIGGER trg_lead_selections_updated_at
  BEFORE UPDATE ON lead_selections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
--  6. CYCLES — add application_type column
-- ============================================================

ALTER TABLE cycles
  ADD COLUMN application_type application_type NOT NULL DEFAULT 'member';


-- ============================================================
--  7. CYCLE STAGES (new table for Option B flow templates)
-- ============================================================

CREATE TABLE cycle_stages (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id              UUID              NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  stage                 application_stage NOT NULL,
  display_order         INT               NOT NULL,
  is_active             BOOLEAN           NOT NULL DEFAULT TRUE,
  required_assignments  INT               NOT NULL DEFAULT 0,
  label                 TEXT,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  UNIQUE (cycle_id, stage)
);

CREATE INDEX idx_cycle_stages_cycle ON cycle_stages(cycle_id);


-- ============================================================
--  8. INDEXES — rename applicant → user
-- ============================================================

DROP INDEX idx_applications_applicant;
CREATE INDEX idx_applications_user ON applications(user_nuid);

-- Add GIN index for roles array lookups
CREATE INDEX idx_users_roles ON users USING GIN (roles);

-- Update questions index to use renamed column
DROP INDEX idx_questions_cycle_role;
CREATE INDEX idx_questions_cycle_role ON questions(cycle_id, application_role);


-- ============================================================
--  9. GENERALIZE code challenge → challenge
--     Drop the GitHub-specific naming so these tables can serve
--     non-code roles too (e.g. design/written challenges).
-- ============================================================

-- 9a. code_challenges: the template/challenge link
ALTER TABLE code_challenges
  RENAME COLUMN github_repo_url TO challenge_url;

-- 9b. code_submissions: the applicant's submission link
ALTER TABLE code_submissions
  RENAME COLUMN github_repo_url TO submission_url;
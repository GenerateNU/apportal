-- ============================================================
--  question_type: score
--  A 1-10 numeric rating question type, used by review_questions to
--  replace written_reviews' old fixed overall_score column.
--
--  This value is used later in this same file (the backfill INSERT below),
--  so it must be committed here first — Postgres does not allow a
--  newly-added enum value to be used within the same transaction that added
--  it.
-- ============================================================

ALTER TYPE question_type ADD VALUE 'score';

COMMIT;

-- ============================================================
--  REVIEW QUESTIONS
--  Chief-defined rubric questions for lead written reviews, scoped to a
--  cycle and (optionally) a specific role — same shape as `questions`,
--  minus page_title (review forms are short; no multi-page need).
-- ============================================================

CREATE TABLE review_questions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID          NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role,                     -- NULL = shown for all roles
  question_text    TEXT          NOT NULL,
  question_type    question_type NOT NULL DEFAULT 'long_answer',
  is_required      BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order    INT           NOT NULL DEFAULT 0,
  options          JSONB,                                -- for multiple_choice / checkbox
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
--  WRITTEN REVIEW ANSWERS
--  A reviewer's answer to one review_questions row, within one written
--  review. Replaces written_reviews' old fixed overall_score/reasoning.
-- ============================================================

CREATE TABLE written_review_answers (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           UUID  NOT NULL REFERENCES written_reviews(id) ON DELETE CASCADE,
  review_question_id  UUID  NOT NULL REFERENCES review_questions(id),
  answer_text         TEXT,
  answer_options      JSONB,           -- for checkbox / multiple choice responses
  score               INT   CHECK (score BETWEEN 1 AND 10),
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (review_id, review_question_id)
);

-- ============================================================
--  Backfill: preserve existing written_reviews.overall_score/reasoning
--  data as review_questions/written_review_answers before those columns
--  are dropped below.
--
--  For every (cycle, role) that already has at least one written review
--  with a non-null overall_score/reasoning, create the equivalent review
--  question, then migrate every existing review's value onto it.
-- ============================================================

INSERT INTO review_questions (cycle_id, application_role, question_text, question_type, is_required, display_order)
SELECT DISTINCT a.cycle_id, a.application_role, 'Overall score', 'score'::question_type, true, 0
FROM written_reviews wr
JOIN applications a ON a.id = wr.application_id
WHERE wr.overall_score IS NOT NULL;

INSERT INTO review_questions (cycle_id, application_role, question_text, question_type, is_required, display_order)
SELECT DISTINCT a.cycle_id, a.application_role, 'Reasoning', 'long_answer'::question_type, true, 1
FROM written_reviews wr
JOIN applications a ON a.id = wr.application_id
WHERE wr.reasoning IS NOT NULL;

INSERT INTO written_review_answers (review_id, review_question_id, score)
SELECT wr.id, rq.id, wr.overall_score
FROM written_reviews wr
JOIN applications a ON a.id = wr.application_id
JOIN review_questions rq
  ON rq.cycle_id = a.cycle_id
  AND rq.application_role = a.application_role
  AND rq.question_text = 'Overall score'
WHERE wr.overall_score IS NOT NULL;

INSERT INTO written_review_answers (review_id, review_question_id, answer_text)
SELECT wr.id, rq.id, wr.reasoning
FROM written_reviews wr
JOIN applications a ON a.id = wr.application_id
JOIN review_questions rq
  ON rq.cycle_id = a.cycle_id
  AND rq.application_role = a.application_role
  AND rq.question_text = 'Reasoning'
WHERE wr.reasoning IS NOT NULL;

-- ============================================================
--  written_reviews.overall_score/reasoning are now dynamic review
--  questions/answers instead of fixed columns. Existing data was
--  backfilled above.
-- ============================================================

ALTER TABLE written_reviews
  DROP COLUMN overall_score,
  DROP COLUMN reasoning;

-- ============================================================
--  written_review_answer_scores is removed. Lead reviews now ask about the
--  application as a whole via review_questions/written_review_answers,
--  rather than scoring each individual applicant answer.
-- ============================================================

DROP TABLE written_review_answer_scores;

-- ============================================================
--  application_templates.review_status / review_closes_at
--  A separate open/closed state and deadline for when a cycle+role's lead
--  reviews should be done, independent of the application's own
--  status/closes_at. Purely informational/tracking — unlike
--  application_templates.closes_at (enforced in handlers/applications.go's
--  deadlinePassed check), review_closes_at is never enforced anywhere:
--  reviewers can still submit a written review after it passes.
-- ============================================================

ALTER TABLE application_templates
  ADD COLUMN review_status cycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN review_closes_at TIMESTAMPTZ;

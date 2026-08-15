-- An open comment thread on an application's interview, for calibration
-- discussion. Unlike chief_review_comments, any reviewer may post here, not
-- just chiefs — see interview_comments handler's requireReviewer gate.
CREATE TABLE interview_comments (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_nuid     TEXT  NOT NULL REFERENCES users(nuid),
  body            TEXT  NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_comments_app ON interview_comments(application_id);

CREATE TRIGGER trg_interview_comments_updated_at
  BEFORE UPDATE ON interview_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

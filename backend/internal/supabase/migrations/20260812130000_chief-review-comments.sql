-- Chiefs previously got one optional "notes" field alongside their vote.
-- Replace it with a proper comment thread: any number of comments per chief
-- per application, each editable by its author.
CREATE TABLE chief_review_comments (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_nuid     TEXT  NOT NULL REFERENCES users(nuid),
  body            TEXT  NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chief_review_comments_app ON chief_review_comments(application_id);

CREATE TRIGGER trg_chief_review_comments_updated_at
  BEFORE UPDATE ON chief_review_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO chief_review_comments (application_id, author_nuid, body, created_at, updated_at)
SELECT application_id, reviewer_nuid, notes, created_at, updated_at
FROM chief_reviews
WHERE notes IS NOT NULL AND btrim(notes) <> '';

ALTER TABLE chief_reviews DROP COLUMN notes;

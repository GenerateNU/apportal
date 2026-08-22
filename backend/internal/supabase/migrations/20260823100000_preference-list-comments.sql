-- An open comment thread within a preference-list group, for the leads on
-- it to discuss out loud — mirrors interview_comments' shape (any member may
-- post, edit only their own). application_id is nullable: NULL is a comment
-- on the group as a whole; set is a comment on that one applicant/entry.
-- Scoped to shared-list entries only, not personal lists.
CREATE TABLE preference_list_comments (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_list_id  UUID  NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  application_id      UUID  REFERENCES applications(id) ON DELETE CASCADE,
  author_nuid         TEXT  NOT NULL REFERENCES users(nuid),
  body                TEXT  NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preference_list_comments_list ON preference_list_comments(preference_list_id);

CREATE TRIGGER trg_preference_list_comments_updated_at
  BEFORE UPDATE ON preference_list_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

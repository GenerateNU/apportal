-- Decisions: the space where rejection messages get composed and handed off.
-- Acceptances are handwritten and never appear here.
--
-- Two kinds, because the message differs by whether we spoke to them: an
-- applicant who interviewed gets the interviewer's specific feedback, one who
-- didn't gets the same letter minus that paragraph.
CREATE TYPE decision_kind AS ENUM ('rejection_post_interview', 'rejection_generic');

-- Chief-edited per (cycle, role, kind), the same shape as interview_script:
-- GetOrCreateDecisionTemplate seeds default content the first time a cycle's
-- template is asked for, so callers never handle a missing row. The signature
-- is the tail of `body` rather than its own column — it's fixed per cycle and
-- the admin edits it in place with the rest of the letter.
CREATE TABLE decision_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role NOT NULL,
  kind             decision_kind NOT NULL,
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       TEXT REFERENCES users(nuid),

  UNIQUE (cycle_id, application_role, kind)
);

CREATE TRIGGER trg_decision_templates_updated_at
  BEFORE UPDATE ON decision_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per application, holding the *parts* of the message rather than the
-- rendered text: fixing a typo in the cycle's template then fixes every message
-- that hasn't been sent, instead of thirty copies of it.
--
-- body_override is the escape hatch for a chief who wants to rewrite one
-- message by hand; NULL (the normal case) means "render from the template".
--
-- There's no status column. Pending/ready is derivable from whether the
-- feedback is written, and a stored copy would go stale every time a lead
-- filled in their paragraph without remembering to flip it (see
-- models.DecisionRow.Status).
CREATE TABLE decision_drafts (
  id             UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  -- Derived from whether the applicant interviewed, then pinned here on first
  -- write so a late-arriving interview record can't swap the template out from
  -- under feedback a lead already wrote. A chief can still change it.
  kind           decision_kind NOT NULL,
  feedback       TEXT,
  compliments    TEXT,
  body_override  TEXT,
  author_nuid    TEXT REFERENCES users(nuid),
  sent_at        TIMESTAMPTZ,
  sent_by        TEXT REFERENCES users(nuid),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_decision_drafts_updated_at
  BEFORE UPDATE ON decision_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  REVIEW RELEASES  (blind-review gate, per cycle × role × review kind)
--  While reviewers write their reviews they may only see their own.
--  A chief "releases" a cycle's reviews for one role and kind at once
--  ('written' = lead written reviews, 'recording' = interview recording
--  review comments), ungating them for all reviewers of that role. Software
--  engineer and software designer applicants are gated independently.
--  A row here = released; deleting the row hides them again. Chiefs and
--  admins bypass the gate and may release at any point, even before every
--  assigned reviewer has submitted.
-- ============================================================

CREATE TABLE review_releases (
  cycle_id     UUID         NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  role         role         NOT NULL,  -- gated independently per applicant role
  review_kind  TEXT         NOT NULL CHECK (review_kind IN ('written', 'recording')),
  released_by  TEXT         NOT NULL REFERENCES users(nuid),  -- chief who released
  released_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  PRIMARY KEY (cycle_id, role, review_kind)
);

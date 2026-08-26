-- The draft: teams take turns claiming applicants in snake order (1..N, then
-- N..1, and so on). One draft per (cycle, application_role) — teams draft
-- engineers and designers on separate boards, the same way preference list
-- ranks and deadlines are already scoped per role.
--
-- A team is a preference_lists group, not a new roster: those groups already
-- hold the leads and the ranking they built to draft from, so the board can
-- show a team's own list beside the pool.
--
-- Picks are keyed by pick_number, and pick_number determines the team on the
-- clock (see the snake formula in store/drafts.go). Nothing derives from row
-- order, so removing a pick leaves an empty slot that belongs to the same
-- team as before and gets filled next — that is what makes undo cheap.

CREATE TABLE drafts (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role NOT NULL,
  status           TEXT  NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'complete')),
  -- How many times around the board. The operator sets it up front so the
  -- grid has a shape, and can raise it mid-draft.
  rounds           INT   NOT NULL DEFAULT 1 CHECK (rounds > 0),
  created_by       TEXT  NOT NULL REFERENCES users(nuid),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (cycle_id, application_role)
);

CREATE TRIGGER trg_drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE draft_teams (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id           UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  preference_list_id UUID NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  -- 0-based seat in the order. Not uniquely constrained, so a reorder can
  -- rewrite every row in one statement (same as preference_list_entries.rank).
  position           INT  NOT NULL,

  UNIQUE (draft_id, preference_list_id)
);

CREATE INDEX idx_draft_teams_draft ON draft_teams(draft_id, position);

CREATE TABLE draft_picks (
  id             UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id       UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  -- 1-based across the whole draft, not per round.
  pick_number    INT  NOT NULL CHECK (pick_number > 0),
  draft_team_id  UUID NOT NULL REFERENCES draft_teams(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  -- The stage the applicant was in before the pick moved them to accepted,
  -- so undoing a pick puts them back where they were rather than guessing.
  previous_stage application_stage NOT NULL,
  picked_by      TEXT NOT NULL REFERENCES users(nuid),
  picked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (draft_id, pick_number),
  -- One team per applicant: the whole point of drafting in turns.
  UNIQUE (draft_id, application_id)
);

CREATE INDEX idx_draft_picks_draft ON draft_picks(draft_id, pick_number);
CREATE INDEX idx_draft_picks_application ON draft_picks(application_id);

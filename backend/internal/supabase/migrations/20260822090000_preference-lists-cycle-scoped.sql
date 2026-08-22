-- A preference list ("group") is now scoped to a cycle only; role becomes
-- a per-entry concept derived from each entry's own application, so one
-- group can manage rankings for every role in its cycle instead of needing
-- a separate list per role. preference_list_deadlines is untouched — still
-- one row per (cycle_id, role), governing every group's entries for that
-- role regardless of which group they're in.
DROP INDEX idx_preference_lists_cycle_role;
ALTER TABLE preference_lists DROP COLUMN application_role;
CREATE INDEX idx_preference_lists_cycle ON preference_lists(cycle_id);

-- A lead's personal ranking within a group: same shape as the shared
-- entries table, but scoped to one owner. Visible to every group member
-- (and chiefs/admins); only the owner can write to it. Never
-- deadline-gated — it's a private scratchpad, not part of the reviewed
-- decision.
CREATE TABLE preference_list_personal_entries (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_list_id  UUID  NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  owner_nuid          TEXT  NOT NULL REFERENCES users(nuid),
  application_id      UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rank                INT   NOT NULL,
  reasoning           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (preference_list_id, owner_nuid, application_id)
);

CREATE INDEX idx_preference_list_personal_entries_list_owner
  ON preference_list_personal_entries(preference_list_id, owner_nuid);

CREATE TRIGGER trg_preference_list_personal_entries_updated_at
  BEFORE UPDATE ON preference_list_personal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

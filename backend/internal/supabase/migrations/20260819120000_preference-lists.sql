-- Preference lists let leads collaboratively rank the applicants they want
-- for a given (cycle, application_role). Multiple lists can coexist per
-- cycle+role: any lead can start one and invite whichever other leads they
-- want to co-edit it. Membership (not authorship) is the access boundary —
-- see preference_list_members — and chiefs/admins can always see and
-- manage every list regardless of membership.
--
-- Entries reference real applications rows (not free-typed names), so a
-- list stays cross-referenceable with the rest of the pipeline.
--
-- preference_list_deadlines is a separate per-(cycle, role) settings row,
-- mirroring application_templates.closes_at / interview_script's scoping,
-- since one deadline governs every list for that cycle+role rather than
-- each list owning its own.

CREATE TABLE preference_lists (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role NOT NULL,
  name             TEXT  NOT NULL,
  status           TEXT  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_by       TEXT  NOT NULL REFERENCES users(nuid),
  submitted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preference_lists_cycle_role ON preference_lists(cycle_id, application_role);

CREATE TRIGGER trg_preference_lists_updated_at
  BEFORE UPDATE ON preference_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE preference_list_members (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_list_id  UUID  NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  lead_nuid           TEXT  NOT NULL REFERENCES users(nuid),
  added_by            TEXT  NOT NULL REFERENCES users(nuid),
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (preference_list_id, lead_nuid)
);

CREATE INDEX idx_preference_list_members_lead ON preference_list_members(lead_nuid);

CREATE TABLE preference_list_entries (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_list_id  UUID  NOT NULL REFERENCES preference_lists(id) ON DELETE CASCADE,
  application_id      UUID  NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rank                INT   NOT NULL,
  reasoning           TEXT,
  updated_by          TEXT  NOT NULL REFERENCES users(nuid),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (preference_list_id, application_id)
);

CREATE INDEX idx_preference_list_entries_list ON preference_list_entries(preference_list_id);

CREATE TRIGGER trg_preference_list_entries_updated_at
  BEFORE UPDATE ON preference_list_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE preference_list_deadlines (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID  NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role NOT NULL,
  closes_at        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       TEXT REFERENCES users(nuid),

  UNIQUE (cycle_id, application_role)
);

CREATE TRIGGER trg_preference_list_deadlines_updated_at
  BEFORE UPDATE ON preference_list_deadlines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

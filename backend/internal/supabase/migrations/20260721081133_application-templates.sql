-- ============================================================
--  APPLICATION TEMPLATES
--  Per-role application content within a cycle (e.g. Software Engineer
--  vs Software Designer applications in the same cycle each get their
--  own title/description/instructions). opens_at/closes_at/is_published
--  are stored for future use but are not yet enforced anywhere — the
--  cycle-level status/dates remain the only thing that gates access.
-- ============================================================

CREATE TABLE application_templates (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         UUID              NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  application_role application_role  NOT NULL,
  title            TEXT              NOT NULL,
  description      TEXT,                                  -- shown at the top of the form
  instructions     TEXT,                                  -- any submission instructions
  opens_at         TIMESTAMPTZ,                            
  closes_at        TIMESTAMPTZ,                            
  is_published     BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  UNIQUE (cycle_id, application_role)
);

CREATE TRIGGER trg_application_templates_updated_at
  BEFORE UPDATE ON application_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  applications.stage now defaults to 'draft'
--  A newly created application row starts as a private, autosaved draft;
--  it only becomes 'submitted' via an explicit PATCH once the applicant
--  finishes.
-- ============================================================

ALTER TABLE applications ALTER COLUMN stage SET DEFAULT 'draft';


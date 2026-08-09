-- ============================================================
--  applications.submitted_at was defaulting to NOW() at row creation and
--  never updated afterward, so it actually recorded when the draft was
--  created — not when the applicant submitted. Every other submit-style
--  table in this schema (written_reviews, interviews,
--  interview_recording_reviews) already gets this right: submitted_at is
--  nullable, has no default, and is only stamped at the moment of an actual
--  submit. Bring applications in line with that pattern.
--
--  Application code now stamps submitted_at = NOW() explicitly on the
--  draft->submitted transition (see store.ApplicationUpdate.MarkSubmitted /
--  handlers.applications.update).
-- ============================================================

ALTER TABLE applications ALTER COLUMN submitted_at DROP NOT NULL;
ALTER TABLE applications ALTER COLUMN submitted_at DROP DEFAULT;

-- Rows still in draft never had a real submission — their submitted_at was
-- always just their creation time. Null it out rather than leave a
-- misleading value. (This also covers rows the previous backfill migration
-- just reset from 'submitted' back to 'draft'.)
UPDATE applications SET submitted_at = NULL WHERE stage = 'draft';

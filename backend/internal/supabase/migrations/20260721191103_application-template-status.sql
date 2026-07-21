-- ============================================================
--  application_templates.status
--  Adds a per-(cycle, role) status reusing the existing cycle_status enum,
--  backfilled from the owning cycle's current status. Replaces is_published,
--  which only captured a published/unpublished binary — status carries the
--  same draft/open/closed/archived lifecycle the rest of the app already
--  uses for cycles.
-- ============================================================

ALTER TABLE application_templates
  ADD COLUMN status cycle_status;

UPDATE application_templates AS t
SET status = c.status
FROM cycles c
WHERE c.id = t.cycle_id;

ALTER TABLE application_templates
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE application_templates
  DROP COLUMN is_published;

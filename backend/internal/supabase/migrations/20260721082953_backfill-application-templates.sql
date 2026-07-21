-- ============================================================
--  BACKFILL: application_templates
--  Seeds one row per (cycle, role) for every existing cycle, since the
--  app currently treats software_engineer/software_designer as the only
--  two applicant roles regardless of cycle. Title defaults to just
--  "<Role> Application"; description/instructions are left NULL.
--  is_published mirrors the cycle's current status (TRUE only for cycles
--  already open) so the backfill reflects what's actually live today.
--  Upserts on (cycle_id, application_role) so this is safe to run whether
--  or not rows already exist for a given cycle/role.
-- ============================================================

INSERT INTO application_templates (cycle_id, application_role, title, is_published)
SELECT
  c.id,
  r.role,
  (CASE r.role
    WHEN 'software_engineer' THEN 'Software Engineer'
    WHEN 'software_designer' THEN 'Software Designer'
  END) || ' Application',
  c.status = 'open'
FROM cycles c
CROSS JOIN (
  VALUES ('software_engineer'::application_role), ('software_designer'::application_role)
) AS r(role)
ON CONFLICT (cycle_id, application_role) DO UPDATE SET
  title        = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

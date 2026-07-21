-- ============================================================
--  BACKFILL: application_templates
--  Seeds one row per (cycle, role) for every existing cycle, since the
--  app currently treats software_engineer/software_designer as the only
--  two applicant roles regardless of cycle. Title defaults to
--  "<cycle name> — <Role> Application"; description/instructions are left
--  NULL and is_published defaults to FALSE until an admin fills them in.
-- ============================================================

INSERT INTO application_templates (cycle_id, application_role, title)
SELECT
  c.id,
  r.role,
  c.name || ' — ' || (CASE r.role
    WHEN 'software_engineer' THEN 'Software Engineer'
    WHEN 'software_designer' THEN 'Software Designer'
  END) || ' Application'
FROM cycles c
CROSS JOIN (
  VALUES ('software_engineer'::application_role), ('software_designer'::application_role)
) AS r(role)
ON CONFLICT (cycle_id, application_role) DO NOTHING;

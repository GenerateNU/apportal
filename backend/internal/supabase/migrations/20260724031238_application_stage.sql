-- ============================================================
--  application_stage: draft
--  A private, pre-submission state for an application that's still being
--  filled out (supports autosave). Invisible to reviewers; only its owner
--  can see it until they submit.
-- ============================================================

ALTER TYPE application_stage ADD VALUE 'draft' BEFORE 'submitted';

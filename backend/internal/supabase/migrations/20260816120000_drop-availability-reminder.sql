-- Applicants now give their meeting availability in the application itself, so
-- the interviewer no longer has to chase a separate form.
ALTER TABLE interview_script DROP COLUMN availability_reminder;

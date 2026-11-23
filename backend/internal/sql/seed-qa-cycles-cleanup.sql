BEGIN;

CREATE TEMP TABLE qa_cycles ON COMMIT DROP AS
SELECT id FROM cycles WHERE id::text LIKE '0a000000-0000-4000-8000-%';

DELETE FROM applications WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM preference_lists WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM drafts WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM application_templates WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM questions WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM review_questions WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM interview_script WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM decision_templates WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM review_releases WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM review_cutoffs WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM code_challenges WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM cycle_staff WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM roles WHERE cycle_id IN (SELECT id FROM qa_cycles);
DELETE FROM cycles WHERE id IN (SELECT id FROM qa_cycles);

DELETE FROM users u
WHERE u.nuid LIKE '9001%' AND u.email LIKE 'qa.applicant%@example.com'
  AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_nuid = u.nuid);

COMMIT;

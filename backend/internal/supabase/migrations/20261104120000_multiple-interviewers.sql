ALTER TABLE interview_assignments
  DROP CONSTRAINT interview_assignments_application_id_key,
  ADD CONSTRAINT interview_assignments_application_id_interviewer_nuid_key
    UNIQUE (application_id, interviewer_nuid);

ALTER TABLE interviews
  DROP CONSTRAINT interviews_application_id_key,
  ADD CONSTRAINT interviews_application_id_interviewer_nuid_key
    UNIQUE (application_id, interviewer_nuid);

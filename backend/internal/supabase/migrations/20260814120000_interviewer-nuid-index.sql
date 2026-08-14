-- The "my interviews" queue filters applications by interviewer
-- (EXISTS ... WHERE interviewer_nuid = $1), the interview-side counterpart of
-- lead_assignments' idx_lead_assignments_lead, which already covers the same
-- lookup for the lead review queue.
CREATE INDEX idx_interview_assignments_interviewer
  ON interview_assignments(interviewer_nuid);

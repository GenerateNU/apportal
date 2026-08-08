-- ============================================================
--  application_stage: interview
--  A single generic "Interview" stage a chief can move an application into
--  manually, alongside the existing granular interview_scheduled /
--  interview_conducted / interview_review stages (which stay driven by the
--  interview-assignment/recording-review flows). Placed between chief_review
--  and interview_scheduled to match the pipeline's natural order.
-- ============================================================

ALTER TYPE application_stage ADD VALUE 'interview' AFTER 'chief_review';

-- ============================================================
--  Backfill: applications wrongly stuck as 'submitted'
--
--  Before 20260724031400_application_2.sql set the column default to
--  'draft', new application rows defaulted to stage = 'submitted' (see
--  20260616233655_init.sql). Any application created before that fix landed
--  was inserted as 'submitted' even though it was really just an untouched
--  autosaved draft — it never went through the completeness check in
--  requireComplete() (backend/internal/handlers/applications.go), because
--  that check only runs on the applicant's own explicit submit action.
--
--  Symptom: these rows show as "Submitted" in the UI with required
--  questions rendering "No response".
--
--  This backfill re-derives stage for any row still sitting at the initial
--  'submitted' stage (i.e. never advanced further into the review
--  pipeline, which would imply a reviewer actually looked at it) by
--  checking whether all required questions are actually answered and any
--  required code challenge has a submission on file. Anything incomplete
--  is reset to 'draft' so it's private again and must go through an
--  explicit, validated submit.
-- ============================================================

UPDATE applications a
SET stage = 'draft'
WHERE a.stage = 'submitted'
  AND (
    EXISTS (
      SELECT 1
      FROM questions q
      WHERE q.cycle_id = a.cycle_id
        AND q.is_required
        AND (q.application_role = a.application_role OR q.application_role IS NULL)
        AND NOT EXISTS (
          SELECT 1
          FROM written_answers wa
          WHERE wa.application_id = a.id
            AND wa.question_id = q.id
            AND (
              (wa.answer_text IS NOT NULL AND btrim(wa.answer_text) <> '')
              OR (wa.answer_file_path IS NOT NULL AND btrim(wa.answer_file_path) <> '')
              OR (
                jsonb_typeof(wa.answer_options) = 'array'
                AND jsonb_array_length(wa.answer_options) > 0
              )
            )
        )
    )
    OR (
      EXISTS (
        SELECT 1 FROM code_challenges cc
        WHERE cc.cycle_id = a.cycle_id
          AND cc.application_role = a.application_role
      )
      AND NOT EXISTS (
        SELECT 1 FROM code_submissions cs
        WHERE cs.application_id = a.id
      )
    )
  );

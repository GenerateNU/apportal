-- Marking a decision sent is what rejects the applicant: the email going out
-- is the decision taking effect, so the two shouldn't be separate chores a
-- chief can do one of and forget the other.
--
-- previous_stage records where they were beforehand so unmarking restores it
-- rather than guessing — the same trick draft_picks uses to make undo cheap.
ALTER TABLE decision_drafts ADD COLUMN previous_stage application_stage;

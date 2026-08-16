-- Interview script becomes scoped per (cycle, application_role), like
-- application_templates, since chiefs run a separate interview process per
-- cycle/role and want a different script for each (different challenge
-- follow-ups, an intro speech with that cycle's actual dates already filled
-- in, etc.) rather than one script shared by everyone forever.
--
-- The single existing row already has a chief's real edits for the active
-- cycle (dates, weekly hours filled in), so it's migrated forward rather
-- than dropped: attached to the currently open cycle's software_engineer
-- script, then cloned for software_designer so neither role loses the
-- customization. GetOrCreateInterviewScript seeds fresh default content for
-- any other (cycle, role) pair the first time it's requested — the same
-- pattern GetOrCreateApplicationTemplate already uses for
-- application_templates. Assumes 20260816120000_drop-availability-reminder.sql
-- has already run (this table no longer has that column by this point).
ALTER TABLE interview_script DROP CONSTRAINT interview_script_id_check;
ALTER TABLE interview_script DROP CONSTRAINT interview_script_pkey;
ALTER TABLE interview_script ALTER COLUMN id DROP DEFAULT;
ALTER TABLE interview_script ALTER COLUMN id TYPE UUID USING gen_random_uuid();
ALTER TABLE interview_script ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE interview_script ADD PRIMARY KEY (id);

ALTER TABLE interview_script ADD COLUMN cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE;
ALTER TABLE interview_script ADD COLUMN application_role application_role;
ALTER TABLE interview_script ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Cycle names aren't unique in this data, so pick the currently open one
-- rather than matching by name.
UPDATE interview_script
SET cycle_id = (SELECT id FROM cycles WHERE status = 'open' ORDER BY created_at DESC LIMIT 1),
    application_role = 'software_engineer';

INSERT INTO interview_script (
  cycle_id, application_role, intro_speech, recording_reminder, questions,
  closing_note, challenge_intro, challenge_tracks, post_interview_checklist, updated_by
)
SELECT cycle_id, 'software_designer', intro_speech, recording_reminder, questions,
       closing_note, challenge_intro, challenge_tracks, post_interview_checklist, updated_by
FROM interview_script
WHERE application_role = 'software_engineer';

ALTER TABLE interview_script ALTER COLUMN cycle_id SET NOT NULL;
ALTER TABLE interview_script ALTER COLUMN application_role SET NOT NULL;
ALTER TABLE interview_script ADD CONSTRAINT interview_script_cycle_id_application_role_key UNIQUE (cycle_id, application_role);

-- Adds the neutral rating between good/great and do_not_hire, so the
-- interviewer/recording-reviewer scale is the full five points (must_hire,
-- great, good, neutral, do_not_hire) instead of four.
ALTER TYPE interview_rating ADD VALUE 'neutral';

-- The "notes" column has never had a frontend writer, so repurposing it for
-- the interviewer's second link (a Granola notes doc, alongside
-- recording_url) costs nothing — no data to migrate.
ALTER TABLE interviews RENAME COLUMN notes TO notes_url;
COMMENT ON COLUMN interviews.notes_url IS 'link to the interviewer''s notes doc (e.g. Granola)';

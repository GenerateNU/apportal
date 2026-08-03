-- Lets applicants answer a `url`-type question by uploading a PDF instead of
-- typing a link. answer_file_path is the opaque Supabase Storage object key;
-- answer_file_name is the original filename, kept separately for display since
-- the storage path itself doesn't encode it.

ALTER TABLE written_answers
  ADD COLUMN answer_file_path TEXT,
  ADD COLUMN answer_file_name TEXT;

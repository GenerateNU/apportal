-- Replace chief_reviews.advance_to_interview (a yes/no per-chief decision)
-- with a 5-point vote scale, so each chief can express how strongly they
-- feel rather than a flat yes/no. The final advance/reject call is now made
-- separately, by changing the application's stage after discussing votes.
ALTER TABLE chief_reviews ADD COLUMN vote TEXT;

UPDATE chief_reviews
SET vote = CASE
  WHEN advance_to_interview = true THEN 'interview'
  WHEN advance_to_interview = false THEN 'no_interview'
  ELSE NULL
END;

ALTER TABLE chief_reviews
  ADD CONSTRAINT chief_reviews_vote_check
  CHECK (vote IN ('strong_interview', 'interview', 'neutral', 'no_interview', 'strong_no_interview'));

ALTER TABLE chief_reviews DROP COLUMN advance_to_interview;

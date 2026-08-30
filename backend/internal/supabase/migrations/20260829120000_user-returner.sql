-- A returner has already worked on a Generate project in an earlier cycle.
-- That's a fact about the person, not about one application, so it lives on
-- users and carries across cycles without being re-marked. Chief/admin-set
-- only — nobody self-declares it.
ALTER TABLE users
  ADD COLUMN returner BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
--  questions.page_title
--  A non-null page_title marks that a new page starts at this question,
--  titled page_title. Questions are grouped into pages by scanning
--  display_order and starting a new group at each non-null page_title.
-- ============================================================

ALTER TABLE questions ADD COLUMN page_title TEXT;

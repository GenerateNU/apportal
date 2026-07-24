-- ============================================================
--  question_type: dropdown
--  Adds a single-select "dropdown" question type alongside the existing
--  multiple_choice (radio) and checkbox (multi-select) types.
-- ============================================================

ALTER TYPE question_type ADD VALUE 'dropdown';

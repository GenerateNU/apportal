-- ============================================================
--  review_questions.description
--  Optional help text shown under a review question's label — the rubric
--  equivalent of the grey subtext in a form builder. Rendered as Markdown,
--  like the admin-authored application_templates.description/instructions.
--
--  Deliberately not added to `questions`: the applicant-facing form already
--  carries prose via application_templates.description/instructions (before
--  and after the question list) and questions.page_title (section headings),
--  and nothing has asked for per-question help text there yet.
-- ============================================================

ALTER TABLE review_questions ADD COLUMN description TEXT;

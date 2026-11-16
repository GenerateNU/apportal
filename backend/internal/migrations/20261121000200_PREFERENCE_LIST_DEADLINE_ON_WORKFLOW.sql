-- Modify "opening_deadlines" table
ALTER TABLE "public"."opening_deadlines" DROP CONSTRAINT "opening_deadlines_kind_check", ADD CONSTRAINT "opening_deadlines_kind_check" CHECK (kind = ANY (ARRAY['applicant'::text, 'reviewer'::text, 'interviewer'::text, 'recording_reviewer'::text, 'preference_list'::text]));
INSERT INTO "public"."opening_deadlines" ("cycle_id", "role_id", "step", "kind", "due_at", "hard")
SELECT "cycle_id", "role_id", 'decisions', 'preference_list', "closes_at", true
FROM "public"."preference_list_deadlines" WHERE "closes_at" IS NOT NULL
ON CONFLICT DO NOTHING;
-- Drop "preference_list_deadlines" table
DROP TABLE "public"."preference_list_deadlines";

-- Modify "interview_panel_members" table
ALTER TABLE "public"."interview_panel_members" ADD CONSTRAINT "fk_interview_panel_members_staff" FOREIGN KEY ("cycle_id", "user_nuid") REFERENCES "public"."cycle_staff" ("cycle_id", "user_nuid") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "staff_slots" table
ALTER TABLE "public"."staff_slots" ADD CONSTRAINT "fk_staff_slots_staff" FOREIGN KEY ("cycle_id", "user_nuid") REFERENCES "public"."cycle_staff" ("cycle_id", "user_nuid") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Create index "idx_written_answers_question" to table: "written_answers"
CREATE INDEX "idx_written_answers_question" ON "public"."written_answers" ("question_id");

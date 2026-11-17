-- Create index "idx_applications_cycle_role_stage" to table: "applications"
CREATE INDEX "idx_applications_cycle_role_stage" ON "public"."applications" ("cycle_id", "role_id", "stage");
-- Create index "idx_code_challenges_cycle_role" to table: "code_challenges"
CREATE INDEX "idx_code_challenges_cycle_role" ON "public"."code_challenges" ("cycle_id", "role_id");
-- Create index "idx_written_reviews_reviewer" to table: "written_reviews"
CREATE INDEX "idx_written_reviews_reviewer" ON "public"."written_reviews" ("reviewer_nuid");
-- Create index "idx_review_questions_cycle_role" to table: "review_questions"
CREATE INDEX "idx_review_questions_cycle_role" ON "public"."review_questions" ("cycle_id", "role_id");
-- Create index "idx_preference_list_entries_application" to table: "preference_list_entries"
CREATE INDEX "idx_preference_list_entries_application" ON "public"."preference_list_entries" ("application_id");
-- Create index "idx_preference_list_personal_entries_application" to table: "preference_list_personal_entries"
CREATE INDEX "idx_preference_list_personal_entries_application" ON "public"."preference_list_personal_entries" ("application_id");
-- Create index "idx_preference_list_comments_application" to table: "preference_list_comments"
CREATE INDEX "idx_preference_list_comments_application" ON "public"."preference_list_comments" ("application_id");
-- Create index "idx_draft_teams_preference_list" to table: "draft_teams"
CREATE INDEX "idx_draft_teams_preference_list" ON "public"."draft_teams" ("preference_list_id");
-- Create index "idx_draft_picks_team" to table: "draft_picks"
CREATE INDEX "idx_draft_picks_team" ON "public"."draft_picks" ("draft_team_id");

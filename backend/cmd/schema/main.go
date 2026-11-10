// Command schema prints the database schema as SQL for Atlas to diff against
// the migrations: the enums, then the GORM tables. It runs no database.
//
// The set_updated_at function and its triggers aren't here: Atlas's free tier
// rejects functions and triggers, so they live in the migrations by hand and
// every table with an updated_at column needs its own trigger added there.
//
//	make gen-migration MIGRATION_NAME=x
package main

import (
	"fmt"
	"os"

	"ariga.io/atlas-provider-gorm/gormschema"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Keep in step with the enum types in internal/models/enums.go.
const prelude = `
CREATE TYPE application_role AS ENUM ('software_engineer', 'software_designer');
CREATE TYPE application_stage AS ENUM ('draft', 'submitted', 'lead_review', 'chief_review', 'interview', 'interview_scheduled', 'interview_conducted', 'interview_review', 'selection', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE application_type AS ENUM ('member', 'lead', 'chief');
CREATE TYPE cycle_status AS ENUM ('draft', 'open', 'closed', 'archived');
CREATE TYPE decision_kind AS ENUM ('rejection_post_interview', 'rejection_generic');
CREATE TYPE interview_rating AS ENUM ('do_not_hire', 'good', 'great', 'must_hire', 'neutral');
CREATE TYPE question_type AS ENUM ('short_answer', 'long_answer', 'multiple_choice', 'checkbox', 'url', 'dropdown', 'score');
CREATE TYPE user_role AS ENUM ('applicant', 'member', 'lead', 'chief', 'admin');
`

func main() {
	tables, err := gormschema.New("postgres", gormschema.WithConfig(&gorm.Config{NamingStrategy: db.NamingStrategy})).Load(
		&models.User{}, &models.Cycle{}, &models.ApplicationTemplate{}, &models.CycleStage{},
		&models.Question{}, &models.CodeChallenge{}, &models.Application{}, &models.WrittenAnswer{},
		&models.CodeSubmission{}, &models.InterviewScript{}, &models.LeadAssignment{},
		&models.WrittenReview{}, &models.ReviewQuestion{}, &models.WrittenReviewAnswer{},
		&models.ChiefReview{}, &models.ChiefReviewComment{}, &models.InterviewAssignment{},
		&models.InterviewReviewAssignment{}, &models.Interview{}, &models.InterviewRecordingReview{},
		&models.InterviewComment{}, &models.LeadSelection{}, &models.PreferenceList{},
		&models.PreferenceListMember{}, &models.PreferenceListEntry{},
		&models.PreferenceListPersonalEntry{}, &models.PreferenceListComment{},
		&models.PreferenceListDeadline{}, &models.Draft{}, &models.DraftTeam{}, &models.DraftPick{},
		&models.DecisionTemplate{}, &models.DecisionDraft{}, &models.ReviewRelease{},
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to load gorm schema:", err)
		os.Exit(1)
	}

	if _, err := os.Stdout.WriteString(prelude + tables); err != nil {
		fmt.Fprintln(os.Stderr, "failed to write schema:", err)
		os.Exit(1)
	}
}

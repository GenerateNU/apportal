package leadassignment

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestAssigningAReviewerKeepsTheStage(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	nuid := func() string { return "t" + uuid.NewString()[:12] }
	chief, lead := nuid(), nuid()
	for _, n := range []string{chief, lead} {
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
	}
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief'), (?, ?, 'lead')", cycle, chief, cycle, lead)
	app := func(stage models.ApplicationStage) string {
		applicant, id := nuid(), uuid.NewString()
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", applicant, applicant+"@test.example", applicant)
		exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, ?, now())", id, cycle, applicant, role, stage)
		return id
	}
	stage := func(id string) models.ApplicationStage {
		var s []models.ApplicationStage
		if err := db.Model(&models.Application{}).Where("id = ?", id).Pluck("stage", &s).Error; err != nil {
			t.Fatal(err)
		}
		return s[0]
	}

	perApplicant := 2
	if _, err := workflow.NewService(db).SetAssignment(context.Background(), cycle, models.StepReviews, models.KindReviewer, &perApplicant); err != nil {
		t.Fatal(err)
	}

	s := &leadAssignmentService{access: access.NewChecker(db), db: NewLeadAssignmentDB(db), guard: staffing.NewGuard()}
	ctx := testutil.WithActor(middleware.Actor{NUID: chief, Roles: []models.UserRole{models.UserRoleApplicant}})
	assign := func(id string) error {
		in := &CreateLeadAssignmentInput{ID: id}
		in.Body.LeadNUID = lead
		_, err := s.create(ctx, in)
		return err
	}

	for _, st := range []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview, models.StageChiefReview} {
		id := app(st)
		if err := assign(id); err != nil {
			t.Fatalf("%s: %v", st, err)
		}
		if got := stage(id); got != st {
			t.Fatalf("assigning moved %s to %s", st, got)
		}
	}
	for _, st := range []models.ApplicationStage{models.StageInterview, models.StageRejected} {
		testutil.WantStatus(t, assign(app(st)), 409)
	}
}

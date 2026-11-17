package draft

import (
	"errors"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestLiveFinalizedDraftIsLocked(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	chief := "t" + uuid.NewString()[:12]
	exec("INSERT INTO users (nuid, email, full_name, roles) VALUES (?, ?, ?, '{applicant}'::user_role[])", chief, chief+"@test.example", chief)
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief')", cycle, chief)
	applicant := "t" + uuid.NewString()[:12]
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", applicant, applicant+"@test.example", applicant)
	app := uuid.NewString()
	exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'selection', now())", app, cycle, applicant, role)
	var board string
	if err := db.Raw("INSERT INTO drafts (cycle_id, role_id, status, created_by) VALUES (?, ?, 'complete', ?) RETURNING id", cycle, role, chief).Scan(&board).Error; err != nil {
		t.Fatal(err)
	}

	s := &draftService{draftDB: NewDraftDB(db), workflow: workflow.NewService(db)}
	ctx := testutil.WithActor(middleware.Actor{NUID: chief, Roles: []models.UserRole{models.UserRoleApplicant}})
	finalized := func(err error) bool {
		var se huma.StatusError
		return errors.As(err, &se) && se.GetStatus() == 409 && se.Error() == "This draft is finalized."
	}

	if err := s.requireDraftEditable(ctx, board); finalized(err) {
		t.Fatal("a complete board with someone still in selection isn't finalized")
	}
	t.Logf("complete board, 1 still in selection: still editable")

	exec("UPDATE applications SET stage = 'rejected' WHERE id = ?", app)
	if err := s.requireDraftEditable(ctx, board); !finalized(err) {
		t.Fatalf("got %v, want the finalized lock", err)
	}
	t.Logf("complete board, nobody left in selection: edits refused with 409")
}

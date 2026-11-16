package reviewrules

import (
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestDefaultReadsThePipeline(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	if err := pipeline.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}

	r := NewDefault(db)
	lead := testutil.WithActor(middleware.Actor{NUID: "lead"})
	admin := testutil.WithActor(middleware.Actor{NUID: "admin", Roles: []models.UserRole{models.UserRoleAdmin}})
	check := func(wantN int, wantReleased, wantFrozen bool) {
		t.Helper()
		n, err := r.PerApplicant(lead, cycle)
		if err != nil || n != wantN {
			t.Fatalf("per applicant %d %v, want %d", n, err, wantN)
		}
		released, err := r.Released(lead, cycle)
		if err != nil || released[role] != wantReleased {
			t.Fatalf("released %v %v, want %v", released, err, wantReleased)
		}
		frozen, err := r.Frozen(lead, cycle)
		if err != nil || frozen[role] != wantFrozen {
			t.Fatalf("frozen %v %v, want %v", frozen, err, wantFrozen)
		}
		if frozen, _ := r.Frozen(admin, cycle); len(frozen) != 0 {
			t.Fatalf("admins aren't frozen out: %v", frozen)
		}
	}

	check(0, false, false)
	n := 3
	if err := pipeline.SetAssignment(db, cycle, models.StepReviews, models.KindReviewer, &n); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'reviews', now())", cycle, role)
	check(3, true, false)
	exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'interviews', now())", cycle, role)
	check(3, true, true)
}

package interviewboard

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestAssignableStaffAndReviewerTeams(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	nuid := func(name string) string {
		n := "t" + uuid.NewString()[:12]
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", name)
		return n
	}
	chief, onTeam, offTeam, conflicted := nuid("Chief"), nuid("Ana"), nuid("Ben"), nuid("Cal")
	exec("UPDATE users SET roles = '{admin}' WHERE nuid = ?", chief)
	branch, cycle, eng, design, group := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer'), (?, ?, 'Designer')", eng, cycle, design, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'lead'), (?, ?, 'lead'), (?, ?, 'lead')",
		cycle, onTeam, cycle, offTeam, cycle, conflicted)
	exec("INSERT INTO staff_groups (id, cycle_id, name) VALUES (?, ?, 'Eng')", group, cycle)
	exec("INSERT INTO staff_group_members (group_id, user_nuid) VALUES (?, ?), (?, ?)", group, onTeam, group, conflicted)
	exec("INSERT INTO opening_teams (cycle_id, role_id, kind, group_id) VALUES (?, ?, 'reviewer', ?)", cycle, eng, group)
	exec("INSERT INTO step_assignments (cycle_id, step, kind, per_applicant) VALUES (?, 'reviews', 'reviewer', 2)", cycle)
	applicant := nuid("Applicant")
	app := uuid.NewString()
	exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, 'submitted', now())", app, cycle, applicant, eng)
	exec("INSERT INTO review_conflicts (cycle_id, lead_nuid, applicant_nuid) VALUES (?, ?, ?)", cycle, conflicted, applicant)

	ctx := testutil.WithActor(middleware.Actor{NUID: chief, Roles: []models.UserRole{models.UserRoleAdmin}})
	pool, err := staffing.NewService(db).Pool(ctx, cycle, models.KindReviewer)
	if err != nil {
		t.Fatal(err)
	}
	eligible := pool.Eligible
	if got := eligible[eng]; len(got) != 2 || !slices.Contains(got, onTeam) || !slices.Contains(got, conflicted) {
		t.Errorf("engineer reviewers follow the team: %v", got)
	}
	if got := eligible[design]; len(got) != 3 {
		t.Errorf("no team means everyone: %v", got)
	}

	s := newService(access.NewChecker(db), db)
	out, err := s.assignable(ctx, &AssignableInput{ID: cycle, Kind: models.KindReviewer, ApplicationIDs: app})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Body) != 1 || out.Body[0].Locked != "" {
		t.Fatalf("one open application: %+v", out.Body)
	}
	want := map[string]AssignableReason{onTeam: "", offTeam: ReasonNotOnTeam, conflicted: ReasonConflicted}
	names := map[string]string{onTeam: "Ana", offTeam: "Ben", conflicted: "Cal"}
	for _, p := range out.Body[0].Staff {
		if p.Reason != want[p.NUID] || p.Available != (want[p.NUID] == "") || p.FullName != names[p.NUID] {
			t.Errorf("%s: %+v", names[p.NUID], p)
		}
	}

	exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", app, onTeam, chief)
	out, err = s.assignable(ctx, &AssignableInput{ID: cycle, Kind: models.KindReviewer, ApplicationIDs: app})
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range out.Body[0].Staff {
		if p.NUID == onTeam && p.Reason != ReasonAssigned {
			t.Errorf("assigned reviewer: %+v", p)
		}
	}

	out, err = s.assignable(ctx, &AssignableInput{ID: cycle, Kind: models.KindInterviewer, ApplicationIDs: app})
	if err != nil {
		t.Fatal(err)
	}
	if out.Body[0].Locked == "" {
		t.Error("interviewers with no count set should be locked")
	}
}

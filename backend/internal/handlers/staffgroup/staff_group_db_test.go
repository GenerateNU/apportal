package staffgroup

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestMembershipOfAReleasedTeamNeedsConfirm(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	nuid := func() string { return "t" + uuid.NewString()[:12] }
	chief, lead, other := nuid(), nuid(), nuid()
	for _, n := range []string{chief, lead, other} {
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
	}
	branch, cycle, eng, des, team, spare := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer'), (?, ?, 'Designer')", eng, cycle, des, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief'), (?, ?, 'lead'), (?, ?, 'lead')", cycle, chief, cycle, lead, cycle, other)
	exec("INSERT INTO staff_groups (id, cycle_id, name) VALUES (?, ?, 'Eng'), (?, ?, 'Spare')", team, cycle, spare, cycle)
	exec("INSERT INTO opening_teams (cycle_id, role_id, kind, group_id) VALUES (?, ?, 'reviewer', ?)", cycle, eng, team)

	s := newService(access.NewChecker(db), db)
	as := testutil.WithActor(middleware.Actor{NUID: chief, Roles: []models.UserRole{models.UserRoleApplicant}})
	add := func(group string) error {
		_, err := s.addMember(as, &MemberPathInput{ID: cycle, GroupID: group, NUID: lead})
		return err
	}
	if err := add(team); err != nil {
		t.Fatalf("before release: %v", err)
	}
	exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'reviews', now())", cycle, eng)
	_, err := s.addMember(as, &MemberPathInput{ID: cycle, GroupID: team, NUID: other})
	testutil.WantStatus(t, err, http.StatusConflict)
	_, err = s.addMember(middleware.WithIntent(as, middleware.Intent{Confirm: true}), &MemberPathInput{ID: cycle, GroupID: team, NUID: other})
	if err != nil {
		t.Fatalf("confirmed: %v", err)
	}
	if err := add(spare); err != nil {
		t.Fatalf("a group no released team uses stays free: %v", err)
	}
}

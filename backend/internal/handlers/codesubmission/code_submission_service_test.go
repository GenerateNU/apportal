package codesubmission

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func TestCodeSubmissionsNeedTheOwner(t *testing.T) {
	db := testutil.TestDB(t)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	id := uuid.NewString
	nuid := func() string { return "t" + uuid.NewString()[:12] }
	admin, owner, other := nuid(), nuid(), nuid()
	for _, n := range []string{admin, owner, other} {
		role := "applicant"
		if n == admin {
			role = "admin"
		}
		must(db.Exec("INSERT INTO users (nuid, email, full_name, roles) VALUES (?, ?, ?, ?::user_role[])", n, n+"@northeastern.edu", n, "{"+role+"}").Error)
	}
	branch, cycle, role, otherRole := id(), id(), id(), id()
	must(db.Exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "b-"+branch).Error)
	must(db.Exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch).Error)
	must(workflow.EnsureSteps(db, cycle))
	must(db.Exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer'), (?, ?, 'Designer')", role, cycle, otherRole, cycle).Error)
	testutil.FillOutForm(t, db, cycle, role, otherRole)
	chief := nuid()
	must(db.Exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, 'Chief')", chief, chief+"@northeastern.edu").Error)
	must(db.Exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief')", cycle, chief).Error)
	app := id()
	must(db.Exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?, 'draft')", app, cycle, owner, role).Error)
	mine, theirs := id(), id()
	must(db.Exec("INSERT INTO code_challenges (id, cycle_id, role_id, name) VALUES (?, ?, ?, 'mine'), (?, ?, ?, 'theirs')", mine, cycle, role, theirs, cycle, otherRole).Error)

	wf := workflow.NewService(db)
	adminCtx := middleware.WithIntent(testutil.WithActor(middleware.Actor{NUID: admin, Roles: []models.UserRole{models.UserRoleAdmin}}), middleware.Intent{Confirm: true})
	_, err := wf.SetDeadline(adminCtx, workflow.DeadlineInput{CycleID: cycle, RoleID: role, Step: models.StepApplications, Kind: models.KindApplicant, DueAt: time.Now().Add(time.Hour), DefaultHard: true})
	must(err)
	_, err = wf.Release(adminCtx, cycle, role, models.StepApplications)
	must(err)

	s := &codeSubmissionService{access: access.NewChecker(db), workflow: wf, codeSubmissionDB: NewCodeSubmissionDB(db)}
	as := func(n string) middleware.Actor {
		return middleware.Actor{NUID: n, Roles: []models.UserRole{models.UserRoleApplicant}}
	}
	put := func(a *middleware.Actor, challenge string) error {
		in := &UpsertCodeSubmissionInput{ID: app}
		in.Body.ChallengeID, in.Body.SubmissionURL = challenge, "https://github.com/x/y"
		ctx := testutil.WithActor(middleware.Actor{})
		if a != nil {
			ctx = testutil.WithActor(*a)
		}
		_, err := s.upsert(ctx, in)
		return err
	}
	o, x := as(owner), as(other)

	if err := put(nil, mine); err == nil {
		t.Fatal("anonymous callers can't submit")
	}
	if err := put(&x, mine); err == nil {
		t.Fatal("another user can't overwrite the owner's submission")
	}
	testutil.WantStatus(t, put(&o, theirs), http.StatusUnprocessableEntity)
	must(put(&o, mine))

	if _, err := s.list(testutil.WithActor(x), &CodeSubmissionAppInput{ID: app}); err == nil {
		t.Fatal("another user can't read the owner's submissions")
	}
	if out, err := s.list(testutil.WithActor(o), &CodeSubmissionAppInput{ID: app}); err != nil || len(out.Body) != 1 {
		t.Fatalf("the owner reads their own submission: %v", err)
	}

	must(db.Exec("UPDATE applications SET stage = 'submitted' WHERE id = ?", app).Error)
	testutil.WantStatus(t, put(&o, mine), http.StatusForbidden)
}

package application

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

func TestApplicantsDontSeeHiddenState(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	nuid := func() string { return "t" + uuid.NewString()[:12] }
	owner, lead, assigned, chief := nuid(), nuid(), nuid(), nuid()
	for _, n := range []string{owner, lead, assigned, chief} {
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
	}
	branch, cycle, role, tag, app := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	if err := workflow.EnsureSteps(db, cycle); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer')", role, cycle)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'lead'), (?, ?, 'lead'), (?, ?, 'chief')", cycle, lead, cycle, assigned, cycle, chief)
	exec("INSERT INTO cycle_tags (id, cycle_id, name, color) VALUES (?, ?, 'Strong', 'green')", tag, cycle)
	exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at, tag_ids) VALUES (?, ?, ?, ?, 'rejected', now(), ARRAY[?]::uuid[])", app, cycle, owner, role, tag)
	exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", app, assigned, chief)

	checker := access.NewChecker(db)
	s := &applicationService{access: checker, applicationDB: NewApplicationDB(db)}
	as := func(n string) middleware.Actor {
		return middleware.Actor{NUID: n, Roles: []models.UserRole{models.UserRoleApplicant}}
	}
	me := testutil.WithActor(as(owner))

	got, err := s.get(me, &ApplicationIDInput{ID: app})
	if err != nil {
		t.Fatal(err)
	}
	if got.Body.Stage != models.StageSubmitted || len(got.Body.TagIDs) != 0 {
		t.Fatalf("while the cycle runs the applicant only sees submitted and no tags: %s %v", got.Body.Stage, got.Body.TagIDs)
	}
	list, err := s.list(me, &ListApplicationsInput{UserNUID: owner})
	if err != nil {
		t.Fatal(err)
	}
	if len(list.Body.Applications) != 1 || list.Body.Applications[0].Stage != models.StageSubmitted ||
		len(list.Body.Applications[0].TagIDs) != 0 || len(list.Body.StageCounts) != 0 {
		t.Fatalf("own list hides the outcome, tags and counts: %+v", list.Body)
	}
	for name, in := range map[string]*ListApplicationsInput{
		"rating":      {UserNUID: owner, RatingFilters: "must_hire"},
		"stage":       {UserNUID: owner, Stage: "rejected"},
		"assigned_to": {UserNUID: owner, AssignedTo: assigned},
		"tags":        {UserNUID: owner, TagIDs: tag},
	} {
		_, err := s.list(me, in)
		if err == nil {
			t.Fatalf("filtering your own list by %s answers a hidden question", name)
		}
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	}

	staff, err := s.get(testutil.WithActor(as(chief)), &ApplicationIDInput{ID: app})
	if err != nil || staff.Body.Stage != models.StageRejected || len(staff.Body.TagIDs) != 1 {
		t.Fatalf("staff still see the real stage and tags: %v %+v", err, staff)
	}

	exec("UPDATE applications SET stage = 'interview' WHERE id = ?", app)
	got, err = s.get(me, &ApplicationIDInput{ID: app})
	if err != nil || got.Body.Stage != models.StageSubmitted {
		t.Fatalf("in-pipeline stages read as submitted too: %v %+v", err, got)
	}
	exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'feedback', now())", cycle, role)
	exec("UPDATE applications SET stage = 'rejected' WHERE id = ?", app)
	got, err = s.get(me, &ApplicationIDInput{ID: app})
	if err != nil || got.Body.Stage != models.StageSubmitted {
		t.Fatalf("opening Feedback alone doesn't reveal the outcome: %v %+v", err, got)
	}

	write := func(n string) error {
		return checker.CanApplication(testutil.WithActor(as(n)), access.WriteReview, app)
	}
	testutil.WantStatus(t, write(lead), http.StatusForbidden)
	if err := write(assigned); err != nil {
		t.Fatalf("the assigned lead writes the review: %v", err)
	}
	if err := write(chief); err != nil {
		t.Fatalf("a chief can write a review: %v", err)
	}

	exec("UPDATE cycles SET status = 'closed' WHERE id = ?", cycle)
	got, err = s.get(me, &ApplicationIDInput{ID: app})
	if err != nil || got.Body.Stage != models.StageRejected || len(got.Body.TagIDs) != 0 {
		t.Fatalf("once the cycle closes the outcome shows, tags stay hidden: %v %+v", err, got)
	}
}

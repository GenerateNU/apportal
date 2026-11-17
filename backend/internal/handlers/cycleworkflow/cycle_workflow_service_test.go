package cycleworkflow

import (
	"context"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type fixture struct {
	t                                         *testing.T
	db                                        *gorm.DB
	s                                         *service
	now                                       time.Time
	cycleA, cycleB, roleA, roleA2, roleB      string
	admin, chiefA, chiefB, leadA, leadB, appl middleware.Actor
	apps                                      []string
	appB                                      string
}

func actor(nuid string, roles ...models.UserRole) middleware.Actor {
	return middleware.Actor{NUID: nuid, Roles: roles}
}

func newFixture(t *testing.T) *fixture {
	db := testutil.TestDB(t)
	f := &fixture{t: t, db: db, now: time.Now()}
	f.s = newService(db)
	f.s.now = func() time.Time { return f.now }
	id := func() string { return uuid.NewString() }
	nuid := func() string { return "t" + uuid.NewString()[:12] }

	f.admin = actor(nuid(), models.UserRoleAdmin)
	f.chiefA = actor(nuid(), models.UserRoleApplicant)
	f.chiefB = actor(nuid(), models.UserRoleApplicant)
	f.leadA = actor(nuid(), models.UserRoleApplicant)
	f.leadB = actor(nuid(), models.UserRoleApplicant)
	f.appl = actor(nuid(), models.UserRoleApplicant)
	for _, a := range []middleware.Actor{f.admin, f.chiefA, f.chiefB, f.leadA, f.leadB, f.appl} {
		f.exec("INSERT INTO users (nuid, email, full_name, roles) VALUES (?, ?, ?, ?::user_role[])",
			a.NUID, a.NUID+"@test.example", a.NUID, "{"+string(a.Roles[0])+"}")
	}
	branch := id()
	f.exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	f.cycleA, f.cycleB = id(), id()
	for _, c := range []string{f.cycleA, f.cycleB} {
		f.exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", c, branch)
		f.must(workflow.EnsureSteps(db, c))
	}
	f.roleA, f.roleA2, f.roleB = id(), id(), id()
	f.exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer'), (?, ?, 'Designer'), (?, ?, 'Engineer')",
		f.roleA, f.cycleA, f.roleA2, f.cycleA, f.roleB, f.cycleB)
	f.exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief'), (?, ?, 'chief'), (?, ?, 'lead'), (?, ?, 'lead')",
		f.cycleA, f.chiefA.NUID, f.cycleB, f.chiefB.NUID, f.cycleA, f.leadA.NUID, f.cycleB, f.leadB.NUID)
	for i := 0; i < 2; i++ {
		f.apps = append(f.apps, f.application(f.cycleA, f.roleA, models.StageSubmitted))
	}
	f.appB = f.application(f.cycleB, f.roleB, models.StageSubmitted)
	return f
}

func (f *fixture) application(cycle, role string, stage models.ApplicationStage) string {
	applicant := "t" + uuid.NewString()[:12]
	f.exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", applicant, applicant+"@test.example", applicant)
	app := uuid.NewString()
	f.exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage, submitted_at) VALUES (?, ?, ?, ?, ?, now())", app, cycle, applicant, role, stage)
	return app
}

func (f *fixture) exec(sql string, args ...any) {
	f.t.Helper()
	f.must(f.db.Exec(sql, args...).Error)
}

func (f *fixture) must(err error) {
	f.t.Helper()
	if err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) applied(_ workflow.Preview, err error) {
	f.t.Helper()
	f.must(err)
}

func (f *fixture) as(a middleware.Actor) context.Context { return testutil.WithActor(a) }

func (f *fixture) confirmed(a middleware.Actor) context.Context {
	return middleware.WithIntent(f.as(a), middleware.Intent{Confirm: true})
}

func (f *fixture) deadline(role string, step models.Step, kind models.StepKind, due time.Time) {
	f.t.Helper()
	f.applied(f.s.workflow.SetDeadline(f.confirmed(f.admin), workflow.DeadlineInput{CycleID: f.cycleA, RoleID: role, Step: step, Kind: kind, DueAt: due, DefaultHard: true}))
}

func (f *fixture) assignReviewer(app string) {
	f.t.Helper()
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", app, f.leadA.NUID, f.chiefA.NUID)
}

func (f *fixture) release(role string, step models.Step) {
	f.t.Helper()
	f.applied(f.s.workflow.Release(f.confirmed(f.admin), f.cycleA, role, step))
}

func (f *fixture) openApplications() {
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepApplications)
}

func (f *fixture) closeApplications() {
	f.openApplications()
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(-time.Minute))
}

func (f *fixture) advance(ctx context.Context, step models.Step, role *string, ids ...string) (*AdvanceOutput, error) {
	in := &AdvanceInput{ID: f.cycleA, Step: step}
	in.Body.RoleID, in.Body.ApplicationIDs = role, ids
	return f.s.advance(ctx, in)
}

func (f *fixture) stage(app string) models.ApplicationStage {
	var s []models.ApplicationStage
	f.must(f.db.Model(&models.Application{}).Where("id = ?", app).Pluck("stage", &s).Error)
	return s[0]
}

func ptr[T any](v T) *T { return &v }

func TestRoutePermissions(t *testing.T) {
	f := newFixture(t)
	f.openApplications()
	future := f.now.Add(2 * time.Hour)

	read := map[string]int{"admin": 0, "chief": 0, "chief elsewhere": 404, "lead": 0, "lead elsewhere": 404, "applicant": 404, "signed out": 401}
	manage := map[string]int{"admin": 0, "chief": 0, "chief elsewhere": 404, "lead": 403, "lead elsewhere": 404, "applicant": 404, "signed out": 401}
	gated := func(code int) map[string]int {
		m := map[string]int{}
		for k, v := range manage {
			m[k] = v
		}
		m["admin"], m["chief"] = code, code
		return m
	}

	routes := []struct {
		name string
		call func(ctx context.Context) error
		want map[string]int
	}{
		{"list steps", func(ctx context.Context) error { _, err := f.s.listSteps(ctx, &CycleInput{ID: f.cycleA}); return err }, read},
		{"get workflow", func(ctx context.Context) error { _, err := f.s.getWorkflow(ctx, &CycleInput{ID: f.cycleA}); return err }, read},
		{"set step", func(ctx context.Context) error {
			in := &SetStepInput{ID: f.cycleA, Step: models.StepInterviews}
			in.Body.Enabled = false
			_, err := f.s.setStep(ctx, in)
			return err
		}, manage},
		{"set assignment", func(ctx context.Context) error {
			in := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindReviewer}
			in.Body.PerApplicant = 2
			_, err := f.s.setAssignment(ctx, in)
			return err
		}, manage},
		{"remove assignment", func(ctx context.Context) error {
			_, err := f.s.removeAssignment(ctx, &AssignmentInput{ID: f.cycleA, Step: models.StepInterviews, Kind: models.KindRecordingReviewer})
			return err
		}, manage},
		{"set deadline", func(ctx context.Context) error {
			in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant}
			in.Body.DueAt = future
			_, err := f.s.setDeadline(ctx, in)
			return err
		}, manage},
		{"release", func(ctx context.Context) error {
			_, err := f.s.release(ctx, &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications})
			return err
		}, manage},
		{"unrelease", func(ctx context.Context) error {
			_, err := f.s.unrelease(ctx, &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications})
			return err
		}, manage},
		{"advance while open", func(ctx context.Context) error {
			_, err := f.advance(ctx, models.StepApplications, nil, f.apps...)
			return err
		}, gated(409)},
		{"undo with nothing to undo", func(ctx context.Context) error {
			_, err := f.s.undo(ctx, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
			return err
		}, gated(409)},
		{"complete with applicants left", func(ctx context.Context) error {
			_, err := f.s.complete(ctx, &StepInput{ID: f.cycleA, Step: models.StepApplications})
			return err
		}, gated(409)},
		{"close", func(ctx context.Context) error { _, err := f.s.closeCycle(ctx, &CloseInput{ID: f.cycleA}); return err },
			map[string]int{"admin": 0, "chief": 409, "chief elsewhere": 404, "lead": 403, "lead elsewhere": 404, "applicant": 404, "signed out": 401}},
	}
	actors := map[string]context.Context{
		"admin": f.confirmed(f.admin), "chief": f.as(f.chiefA), "chief elsewhere": f.as(f.chiefB),
		"lead": f.as(f.leadA), "lead elsewhere": f.as(f.leadB), "applicant": f.as(f.appl), "signed out": context.Background(),
	}
	for _, r := range routes {
		for who, want := range r.want {
			t.Run(r.name+"/"+who, func(t *testing.T) {
				f.must(f.db.SavePoint("route").Error)
				defer f.db.RollbackTo("route")
				err := r.call(actors[who])
				if want == 0 {
					if err != nil {
						t.Fatalf("got %v, want success", err)
					}
					return
				}
				testutil.WantStatus(t, err, want)
			})
		}
	}
}

func TestInputValidation(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	tooMany := make([]string, utils.MaxBulkApplications+1)
	for i := range tooMany {
		tooMany[i] = uuid.NewString()
	}
	cases := []struct {
		name string
		call func() error
		want int
	}{
		{"malformed cycle id", func() error { _, err := f.s.getWorkflow(chief, &CycleInput{ID: "nope"}); return err }, 422},
		{"invalid step", func() error {
			_, err := f.s.release(chief, &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: "bogus"})
			return err
		}, 422},
		{"invalid kind", func() error {
			in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: "bogus"}
			in.Body.DueAt = f.now
			_, err := f.s.setDeadline(chief, in)
			return err
		}, 422},
		{"kind not on step", func() error {
			in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepReviews, Kind: models.KindApplicant}
			in.Body.DueAt = f.now
			_, err := f.s.setDeadline(chief, in)
			return err
		}, 422},
		{"assignment kind not on step", func() error {
			in := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindInterviewer}
			in.Body.PerApplicant = 1
			_, err := f.s.setAssignment(chief, in)
			return err
		}, 422},
		{"assignment of zero", func() error {
			in := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindReviewer}
			_, err := f.s.setAssignment(chief, in)
			return err
		}, 422},
		{"missing due_at", func() error {
			_, err := f.s.setDeadline(chief, &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant})
			return err
		}, 422},
		{"role from another cycle", func() error {
			_, err := f.s.release(chief, &OpeningStepInput{ID: f.cycleA, RoleID: f.roleB, Step: models.StepApplications})
			return err
		}, 422},
		{"malformed role id", func() error {
			_, err := f.s.release(chief, &OpeningStepInput{ID: f.cycleA, RoleID: "x", Step: models.StepApplications})
			return err
		}, 422},
		{"turning off applications", func() error {
			in := &SetStepInput{ID: f.cycleA, Step: models.StepApplications}
			_, err := f.s.setStep(chief, in)
			return err
		}, 422},
		{"empty application_ids", func() error { _, err := f.advance(chief, models.StepApplications, nil); return err }, 422},
		{"malformed application id", func() error { _, err := f.advance(chief, models.StepApplications, nil, "x"); return err }, 422},
		{"too many application_ids", func() error { _, err := f.advance(chief, models.StepApplications, nil, tooMany...); return err }, 422},
		{"application from another cycle", func() error {
			_, err := f.advance(chief, models.StepApplications, nil, f.apps[0], f.appB)
			return err
		}, 422},
		{"application for another role", func() error {
			_, err := f.advance(chief, models.StepApplications, &f.roleA2, f.apps[0])
			return err
		}, 422},
		{"advance role from another cycle", func() error {
			_, err := f.advance(chief, models.StepApplications, &f.roleB, f.apps[0])
			return err
		}, 422},
		{"advance from the last step", func() error { _, err := f.advance(chief, models.StepFeedback, nil, f.apps[0]); return err }, 422},
		{"advance into feedback", func() error { _, err := f.advance(chief, models.StepDecisions, nil, f.apps[0]); return err }, 422},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f.must(f.db.SavePoint("v").Error)
			defer f.db.RollbackTo("v")
			testutil.WantStatus(t, tc.call(), tc.want)
		})
	}
}

func TestReleaseRules(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	release := func(step models.Step) error {
		_, err := f.s.release(chief, &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: step})
		return err
	}
	testutil.WantStatus(t, release(models.StepApplications), 422)
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	f.must(release(models.StepApplications))
	f.must(release(models.StepApplications))

	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(2*time.Hour))
	testutil.WantStatus(t, release(models.StepReviews), 409)
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(-time.Minute))
	testutil.WantStatus(t, release(models.StepReviews), 409)
	f.assignReviewer(f.apps[0])
	f.must(release(models.StepReviews))

	in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant}
	in.Body.DueAt = f.now.Add(time.Hour)
	_, err := f.s.setDeadline(chief, in)
	testutil.WantStatus(t, err, 409)
	_, err = f.s.setDeadline(f.as(f.admin), in)
	testutil.WantStatus(t, err, 409)
	_, err = f.s.setDeadline(f.confirmed(f.admin), in)
	f.must(err)

	a := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindReviewer}
	a.Body.PerApplicant = 2
	_, err = f.s.setAssignment(chief, a)
	testutil.WantStatus(t, err, 409)

	f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(3*time.Hour))
	rec := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepInterviews, Kind: models.KindRecordingReviewer}
	rec.Body.DueAt = f.now.Add(2 * time.Hour)
	_, err = f.s.setDeadline(chief, rec)
	testutil.WantStatus(t, err, 422)
	rec.Body.DueAt = f.now.Add(4 * time.Hour)
	_, err = f.s.setDeadline(chief, rec)
	f.must(err)
}

func TestAdvanceAndUndo(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()

	out, err := f.advance(chief, models.StepApplications, &f.roleA, f.apps...)
	f.must(err)
	if len(out.Body.MovedApplicationIDs) != 2 || f.stage(f.apps[0]) != models.StageLeadReview {
		t.Fatalf("moved %v, stage %s", out.Body.MovedApplicationIDs, f.stage(f.apps[0]))
	}
	if s := out.Body.Workflow.Steps[0]; s.Step != models.StepApplications || s.Status != workflow.StatusDone || s.CompletedAt == nil {
		t.Fatalf("applications should be done: %+v", s)
	}
	var moves int64
	f.must(f.db.Model(&models.ApplicationMove{}).Where("application_id IN ?", f.apps).Count(&moves).Error)
	if moves != 2 {
		t.Fatalf("want 2 moves, got %d", moves)
	}

	_, err = f.advance(chief, models.StepApplications, nil, f.apps[0])
	testutil.WantStatus(t, err, 409)

	in := &SetStepInput{ID: f.cycleA, Step: models.StepInterviews}
	_, err = f.s.setStep(chief, in)
	testutil.WantStatus(t, err, 409)

	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepReviews})
	testutil.WantStatus(t, err, 409)

	undone, err := f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	f.must(err)
	if len(undone.Body.RestoredApplicationIDs) != 2 || f.stage(f.apps[0]) != models.StageSubmitted {
		t.Fatalf("restored %v, stage %s", undone.Body.RestoredApplicationIDs, f.stage(f.apps[0]))
	}
	if undone.Body.Workflow.Steps[0].Status == workflow.StatusDone {
		t.Fatal("undo should reopen applications")
	}
	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, 409)
}

func TestUndoOnlyOneLevel(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()
	_, err := f.advance(chief, models.StepApplications, nil, f.apps[0])
	f.must(err)
	_, err = f.advance(chief, models.StepApplications, nil, f.apps[1])
	f.must(err)
	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	f.must(err)
	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, 409)
	if f.stage(f.apps[0]) != models.StageLeadReview {
		t.Fatal("the earlier batch must stay put")
	}
}

func TestUndoBlockedByWork(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()
	_, err := f.advance(chief, models.StepApplications, nil, f.apps...)
	f.must(err)
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", f.apps[0], f.leadA.NUID, f.chiefA.NUID)
	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, 409)
}

func TestUndoBlockedByRelease(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()
	_, err := f.advance(chief, models.StepApplications, nil, f.apps...)
	f.must(err)
	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.assignReviewer(f.apps[0])
	f.release(f.roleA, models.StepReviews)
	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, 409)
}

func TestAdvanceOnWorkComplete(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()
	a := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindReviewer}
	a.Body.PerApplicant = 1
	_, err := f.s.setAssignment(chief, a)
	f.must(err)
	_, err = f.advance(chief, models.StepApplications, nil, f.apps[0])
	f.must(err)
	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.assignReviewer(f.apps[0])
	f.release(f.roleA, models.StepReviews)

	_, err = f.advance(chief, models.StepReviews, nil, f.apps[0])
	testutil.WantStatus(t, err, 409)
	f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now())", f.apps[0], f.leadA.NUID)
	_, err = f.advance(chief, models.StepReviews, nil, f.apps[0])
	f.must(err)
	if f.stage(f.apps[0]) != models.StageInterview {
		t.Fatalf("stage %s", f.stage(f.apps[0]))
	}
}

func TestSubmissionGates(t *testing.T) {
	f := newFixture(t)
	gate := workflow.NewService(f.db)
	f.closeApplications()
	testutil.WantStatus(t, gate.RequireOpeningWorkEditable(f.as(f.appl), f.cycleA, f.roleA, workflow.WorkApplication), 403)

	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	f.must(gate.RequireOpeningWorkEditable(f.as(f.appl), f.cycleA, f.roleA, workflow.WorkApplication))

	review := f.application(f.cycleA, f.roleA, models.StageLeadReview)
	f.applied(f.s.workflow.SetDeadline(f.as(f.admin), workflow.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepReviews, Kind: models.KindReviewer, DueAt: f.now.Add(-time.Minute), Hard: ptr(true)}))
	testutil.WantStatus(t, gate.RequireWorkEditable(f.as(f.leadA), review, workflow.WorkWrittenReview), 403)
	f.applied(f.s.workflow.SetDeadline(f.as(f.admin), workflow.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepReviews, Kind: models.KindReviewer, DueAt: f.now.Add(-time.Minute), Hard: ptr(false)}))
	f.must(gate.RequireWorkEditable(f.as(f.leadA), review, workflow.WorkWrittenReview))

	f.exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'interviews', now())", f.cycleA, f.roleA)
	testutil.WantStatus(t, gate.RequireWorkEditable(f.as(f.leadA), review, workflow.WorkWrittenReview), 409)
	testutil.WantStatus(t, gate.RequireWorkEditable(f.as(f.admin), review, workflow.WorkWrittenReview), 409)
	f.must(gate.RequireWorkEditable(f.confirmed(f.admin), review, workflow.WorkWrittenReview))
}

func TestCloseCycle(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	_, err := f.s.closeCycle(chief, &CloseInput{ID: f.cycleA})
	testutil.WantStatus(t, err, 409)
	f.exec("UPDATE cycle_steps SET completed_at = now() WHERE cycle_id = ?", f.cycleA)
	out, err := f.s.closeCycle(chief, &CloseInput{ID: f.cycleA})
	f.must(err)
	if out.Body.Cycle.Status != models.CycleClosed {
		t.Fatalf("status %s", out.Body.Cycle.Status)
	}
}

func TestCompleteStep(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.closeApplications()
	_, err := f.s.complete(chief, &StepInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, 409)
	f.exec("UPDATE applications SET stage = 'rejected' WHERE id IN ?", f.apps)
	out, err := f.s.complete(chief, &StepInput{ID: f.cycleA, Step: models.StepApplications})
	f.must(err)
	if out.Body.CurrentStep == nil || *out.Body.CurrentStep != models.StepReviews {
		t.Fatalf("current %v", out.Body.CurrentStep)
	}
}

func TestMyWorkflowView(t *testing.T) {
	f := newFixture(t)
	f.closeApplications()
	_, err := f.advance(f.as(f.chiefA), models.StepApplications, nil, f.apps...)
	f.must(err)
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?), (?, ?, ?)",
		f.apps[0], f.leadA.NUID, f.chiefA.NUID, f.apps[1], f.leadA.NUID, f.chiefA.NUID)
	f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now())", f.apps[0], f.leadA.NUID)

	lead, err := f.s.getWorkflow(f.as(f.leadA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if lead.Body.Role != "lead" || len(lead.Body.NextActions) != 0 || len(lead.Body.Tasks) != 1 {
		t.Fatalf("lead view: %+v", lead.Body)
	}
	if task := lead.Body.Tasks[0]; task.Kind != workflow.TaskReview || task.Status != workflow.StatusLocked || task.Done != 1 || task.Total != 2 {
		t.Fatalf("task: %+v", task)
	}

	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.assignReviewer(f.apps[0])
	f.release(f.roleA, models.StepReviews)
	lead, err = f.s.getWorkflow(f.as(f.leadA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if task := lead.Body.Tasks[0]; task.Status != workflow.StatusOpen || task.DueAt == nil {
		t.Fatalf("released task: %+v", task)
	}

	chief, err := f.s.getWorkflow(f.as(f.chiefA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if chief.Body.Role != "chief" || len(chief.Body.NextActions) == 0 || chief.Body.CurrentStep == nil || *chief.Body.CurrentStep != models.StepReviews {
		t.Fatalf("chief view: %+v", chief.Body)
	}
	admin, err := f.s.getWorkflow(f.as(f.admin), &CycleInput{ID: f.cycleA})
	f.must(err)
	if admin.Body.Role != "admin" {
		t.Fatalf("admin role %s", admin.Body.Role)
	}
}

// Admins review chief cycles, so they get tasks there like staff do.
func TestAdminTasksOnChiefCycle(t *testing.T) {
	f := newFixture(t)
	f.exec("UPDATE cycles SET application_type = 'chief' WHERE id = ?", f.cycleA)
	f.exec("DELETE FROM cycle_staff WHERE cycle_id = ?", f.cycleA)
	f.closeApplications()
	_, err := f.advance(f.as(f.admin), models.StepApplications, nil, f.apps...)
	f.must(err)
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)",
		f.apps[0], f.admin.NUID, f.admin.NUID)

	admin, err := f.s.getWorkflow(f.as(f.admin), &CycleInput{ID: f.cycleA})
	f.must(err)
	if len(admin.Body.Tasks) != 1 || admin.Body.Tasks[0].Kind != workflow.TaskReview || admin.Body.Tasks[0].Total != 1 {
		t.Fatalf("admin tasks: %+v", admin.Body.Tasks)
	}
}

func TestDraftAndFeedbackTasks(t *testing.T) {
	f := newFixture(t)
	list, draft, interview := uuid.NewString(), uuid.NewString(), uuid.NewString()
	f.exec("INSERT INTO preference_lists (id, cycle_id, name, created_by) VALUES (?, ?, 'Team', ?)", list, f.cycleA, f.chiefA.NUID)
	f.exec("INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by) VALUES (?, ?, ?)", list, f.leadA.NUID, f.chiefA.NUID)
	f.exec("INSERT INTO drafts (id, cycle_id, role_id, status, rounds, created_by) VALUES (?, ?, ?, 'active', 2, ?)", draft, f.cycleA, f.roleA, f.chiefA.NUID)
	f.exec("INSERT INTO draft_teams (draft_id, preference_list_id, position) VALUES (?, ?, 1)", draft, list)

	rejected := f.application(f.cycleA, f.roleA, models.StageRejected)
	written := f.application(f.cycleA, f.roleA, models.StageRejected)
	for _, app := range []string{rejected, written} {
		iv := uuid.NewString()
		if app == written {
			iv = interview
		}
		f.exec("INSERT INTO interviews (id, application_id) VALUES (?, ?)", iv, app)
		f.exec("INSERT INTO interviewers (interview_id, interviewer_nuid, assigned_by) VALUES (?, ?, ?)", iv, f.leadA.NUID, f.chiefA.NUID)
	}
	f.exec(`INSERT INTO decision_drafts (application_id, kind, feedback, compliments, previous_stage)
		VALUES (?, 'rejection_post_interview', 'Feedback', 'Compliments', 'selection')`, written)

	tasks := func() map[workflow.TaskKind]workflow.Task {
		out, err := f.s.getWorkflow(f.as(f.leadA), &CycleInput{ID: f.cycleA})
		f.must(err)
		got := map[workflow.TaskKind]workflow.Task{}
		for _, task := range out.Body.Tasks {
			got[task.Kind] = task
		}
		return got
	}
	got := tasks()
	if c := got[workflow.TaskDraft]; c.RoleID == nil || *c.RoleID != f.roleA || c.Total != 1 || c.Done != 0 {
		t.Errorf("draft task: %+v", c)
	}
	if c := got[workflow.TaskFeedback]; c.RoleID == nil || *c.RoleID != f.roleA || c.Total != 2 || c.Done != 1 {
		t.Errorf("feedback task: %+v", c)
	}

	f.exec("UPDATE drafts SET status = 'complete' WHERE id = ?", draft)
	if c := tasks()[workflow.TaskDraft]; c.Done != 1 {
		t.Errorf("completed draft: %+v", c)
	}
}

func TestAdvanceFollowsTheCycleOrder(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	f.exec("UPDATE cycle_steps SET position = CASE step WHEN 'interviews' THEN 1 WHEN 'reviews' THEN 2 ELSE position END WHERE cycle_id = ?", f.cycleA)
	f.closeApplications()

	out, err := f.advance(chief, models.StepApplications, &f.roleA, f.apps...)
	f.must(err)
	f.wantStage(f.apps[0], models.StageInterview)
	if got := out.Body.Workflow.Steps[1].Step; got != models.StepInterviews {
		t.Fatalf("second step is %s, want interviews", got)
	}

	_, err = f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	f.must(err)
	f.wantStage(f.apps[0], models.StageSubmitted)
}

func TestWorkHiddenWhenItsStepIsOff(t *testing.T) {
	f := newFixture(t)
	svc := workflow.NewService(f.db)
	ctx := f.as(f.chiefA)
	app := f.apps[0]
	for _, w := range []workflow.Work{workflow.WorkInterview, workflow.WorkWrittenReview} {
		if ok, err := svc.WorkVisible(ctx, app, w); err != nil || !ok {
			t.Fatalf("%s should be visible by default: %v", w, err)
		}
	}
	f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'interviews'", f.cycleA)
	if ok, _ := svc.WorkVisible(ctx, app, workflow.WorkInterview); ok {
		t.Fatal("interview work shown for a cycle without interviews")
	}
	if ok, _ := svc.WorkVisible(ctx, app, workflow.WorkRecordingReview); ok {
		t.Fatal("recording reviews shown for a cycle without interviews")
	}
	if ok, _ := svc.WorkVisible(ctx, app, workflow.WorkWrittenReview); !ok {
		t.Fatal("reviews hidden though the cycle runs them")
	}
	ids, err := svc.VisibleApplications(ctx, []string{app, f.appB}, workflow.WorkInterview)
	f.must(err)
	if len(ids) != 1 || ids[0] != f.appB {
		t.Fatalf("visible = %v, want only the other cycle's application", ids)
	}
}

func TestReadableHidesPeerReviewsUntilReleased(t *testing.T) {
	f := newFixture(t)
	chk := access.NewChecker(f.db)
	app := f.apps[0]
	readAs := func(ctx context.Context) access.Readable {
		t.Helper()
		r, err := chk.Readable(ctx, []string{app}, access.Review, workflow.WorkWrittenReview)
		f.must(err)
		return r
	}

	if r := readAs(f.as(f.leadA)); !r.Has(app) || r.Peers[app] {
		t.Fatalf("a lead before release should read only their own: %+v", r)
	}
	if r := readAs(f.as(f.chiefA)); !r.Peers[app] {
		t.Fatalf("a chief always reads every review: %+v", r)
	}
	f.exec("INSERT INTO review_releases (cycle_id, role_id, review_kind, released_by) VALUES (?, ?, 'written', ?)", f.cycleA, f.roleA, f.chiefA.NUID)
	if r := readAs(f.as(f.leadA)); !r.Peers[app] {
		t.Fatalf("a lead after release reads everyone's: %+v", r)
	}
	if r := readAs(f.as(f.leadB)); r.Has(app) {
		t.Fatalf("a lead on another cycle reads nothing: %+v", r)
	}
	f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'reviews'", f.cycleA)
	if r := readAs(f.as(f.chiefA)); r.Has(app) {
		t.Fatalf("no reviews for a cycle that doesn't run them: %+v", r)
	}
}

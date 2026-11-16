package cyclepipeline

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
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
		f.must(pipeline.EnsureSteps(db, c))
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

func (f *fixture) as(a middleware.Actor) context.Context { return testutil.WithActor(a) }

func (f *fixture) deadline(role string, step models.Step, kind models.StepKind, due time.Time) {
	f.t.Helper()
	f.must(pipeline.SetDeadline(f.db, pipeline.DeadlineInput{CycleID: f.cycleA, RoleID: role, Step: step, Kind: kind, DueAt: due, DefaultHard: true, Actor: pipeline.Actor{NUID: f.admin.NUID, Admin: true}}))
}

func (f *fixture) release(role string, step models.Step) {
	f.t.Helper()
	f.must(pipeline.Release(f.db, f.cycleA, role, step, pipeline.Actor{NUID: f.admin.NUID, Admin: true}, f.now))
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
		{"get pipeline", func(ctx context.Context) error { _, err := f.s.getPipeline(ctx, &CycleInput{ID: f.cycleA}); return err }, read},
		{"my pipeline", func(ctx context.Context) error { _, err := f.s.myPipeline(ctx, &CycleInput{ID: f.cycleA}); return err }, read},
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
		{"close", func(ctx context.Context) error { _, err := f.s.closeCycle(ctx, &CycleInput{ID: f.cycleA}); return err },
			map[string]int{"admin": 0, "chief": 409, "chief elsewhere": 404, "lead": 403, "lead elsewhere": 404, "applicant": 404, "signed out": 401}},
	}
	actors := map[string]context.Context{
		"admin": f.as(f.admin), "chief": f.as(f.chiefA), "chief elsewhere": f.as(f.chiefB),
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
		{"malformed cycle id", func() error { _, err := f.s.getPipeline(chief, &CycleInput{ID: "nope"}); return err }, 422},
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
	f.must(release(models.StepReviews))

	in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant}
	in.Body.DueAt = f.now.Add(time.Hour)
	_, err := f.s.setDeadline(chief, in)
	testutil.WantStatus(t, err, 409)
	_, err = f.s.setDeadline(f.as(f.admin), in)
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
	if s := out.Body.Pipeline.Steps[0]; s.Step != models.StepApplications || s.Status != pipeline.StatusDone || s.CompletedAt == nil {
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
	if undone.Body.Pipeline.Steps[0].Status == pipeline.StatusDone {
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
	gate := pipeline.NewGate(f.db)
	f.closeApplications()
	testutil.WantStatus(t, gate.Opening(f.as(f.appl), f.cycleA, f.roleA, models.StepApplications, models.KindApplicant), 403)

	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	f.must(gate.Opening(f.as(f.appl), f.cycleA, f.roleA, models.StepApplications, models.KindApplicant))

	review := f.application(f.cycleA, f.roleA, models.StageLeadReview)
	f.must(pipeline.SetDeadline(f.db, pipeline.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepReviews, Kind: models.KindReviewer, DueAt: f.now.Add(-time.Minute), Hard: ptr(true), Actor: pipeline.Actor{NUID: f.admin.NUID}}))
	testutil.WantStatus(t, gate.Application(f.as(f.leadA), review, models.StepReviews, models.KindReviewer), 403)
	f.must(pipeline.SetDeadline(f.db, pipeline.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepReviews, Kind: models.KindReviewer, DueAt: f.now.Add(-time.Minute), Hard: ptr(false), Actor: pipeline.Actor{NUID: f.admin.NUID}}))
	f.must(gate.Application(f.as(f.leadA), review, models.StepReviews, models.KindReviewer))

	f.exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'interviews', now())", f.cycleA, f.roleA)
	testutil.WantStatus(t, gate.Application(f.as(f.leadA), review, models.StepReviews, models.KindReviewer), 409)
	f.must(gate.Application(f.as(f.admin), review, models.StepReviews, models.KindReviewer))
}

func TestCloseCycle(t *testing.T) {
	f := newFixture(t)
	chief := f.as(f.chiefA)
	_, err := f.s.closeCycle(chief, &CycleInput{ID: f.cycleA})
	testutil.WantStatus(t, err, 409)
	f.exec("UPDATE cycle_steps SET completed_at = now() WHERE cycle_id = ?", f.cycleA)
	out, err := f.s.closeCycle(chief, &CycleInput{ID: f.cycleA})
	f.must(err)
	if out.Body.Status != models.CycleClosed {
		t.Fatalf("status %s", out.Body.Status)
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

func TestMyPipeline(t *testing.T) {
	f := newFixture(t)
	f.closeApplications()
	_, err := f.advance(f.as(f.chiefA), models.StepApplications, nil, f.apps...)
	f.must(err)
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?), (?, ?, ?)",
		f.apps[0], f.leadA.NUID, f.chiefA.NUID, f.apps[1], f.leadA.NUID, f.chiefA.NUID)
	f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now())", f.apps[0], f.leadA.NUID)

	lead, err := f.s.myPipeline(f.as(f.leadA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if lead.Body.Role != "lead" || len(lead.Body.NextActions) != 0 || len(lead.Body.Tasks) != 1 {
		t.Fatalf("lead view: %+v", lead.Body)
	}
	if task := lead.Body.Tasks[0]; task.Kind != pipeline.TaskReview || task.Status != pipeline.StatusLocked || task.Done != 1 || task.Total != 2 {
		t.Fatalf("task: %+v", task)
	}

	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepReviews)
	lead, err = f.s.myPipeline(f.as(f.leadA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if task := lead.Body.Tasks[0]; task.Status != pipeline.StatusOpen || task.DueAt == nil {
		t.Fatalf("released task: %+v", task)
	}

	chief, err := f.s.myPipeline(f.as(f.chiefA), &CycleInput{ID: f.cycleA})
	f.must(err)
	if chief.Body.Role != "chief" || len(chief.Body.NextActions) == 0 || chief.Body.CurrentStep == nil || *chief.Body.CurrentStep != models.StepReviews {
		t.Fatalf("chief view: %+v", chief.Body)
	}
	admin, err := f.s.myPipeline(f.as(f.admin), &CycleInput{ID: f.cycleA})
	f.must(err)
	if admin.Body.Role != "admin" {
		t.Fatalf("admin role %s", admin.Body.Role)
	}
}

func TestTemplateCompat(t *testing.T) {
	f := newFixture(t)
	actor := pipeline.Actor{NUID: f.chiefA.NUID}
	open, closed := models.CycleOpen, models.CycleClosed
	apply := func(in pipeline.TemplateTimeline) error {
		return pipeline.ApplyTemplateTimeline(f.db, f.cycleA, f.roleA, in, actor, f.now)
	}
	fill := func() models.ApplicationTemplate {
		ts := []models.ApplicationTemplate{{CycleID: f.cycleA, RoleID: f.roleA}}
		f.must(pipeline.FillTemplates(f.db, ts, f.now))
		return ts[0]
	}
	testutil.WantStatus(t, apply(pipeline.TemplateTimeline{Status: &open}), http.StatusUnprocessableEntity)
	due := f.now.Add(time.Hour)
	f.must(apply(pipeline.TemplateTimeline{ClosesAt: &due, Status: &open}))
	if got := fill(); got.Status != models.CycleOpen || got.ClosesAt == nil || got.ReviewStatus != models.CycleDraft {
		t.Fatalf("after open: %+v", got)
	}
	f.must(apply(pipeline.TemplateTimeline{Status: &closed}))
	if got := fill(); got.Status != models.CycleClosed {
		t.Fatalf("after close: %+v", got)
	}
	testutil.WantStatus(t, apply(pipeline.TemplateTimeline{Status: &open}), http.StatusConflict)
	reviewDue := f.now.Add(2 * time.Hour)
	f.must(apply(pipeline.TemplateTimeline{ReviewClosesAt: &reviewDue, ReviewStatus: &open}))
	got := fill()
	if got.ReviewStatus != models.CycleOpen || got.ReviewClosesAt == nil {
		t.Fatalf("reviews: %+v", got)
	}
	var hard []bool
	f.must(f.db.Model(&models.OpeningDeadline{}).Where("role_id = ? AND kind = ?", f.roleA, models.KindReviewer).Pluck("hard", &hard).Error)
	if len(hard) != 1 || hard[0] {
		t.Fatal("review_closes_at stays a soft target")
	}
}

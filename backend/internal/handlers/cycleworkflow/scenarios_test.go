package cycleworkflow

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func needsConfirm(t *testing.T, err error) {
	t.Helper()
	var em *huma.ErrorModel
	if !errors.As(err, &em) || em.Status != http.StatusConflict || len(em.Errors) == 0 || em.Errors[0].Location != "query.confirm_override" {
		t.Fatalf("want override_required, got %v", err)
	}
}

func hardRefusal(t *testing.T, err error, status int) {
	t.Helper()
	var em *huma.ErrorModel
	if !errors.As(err, &em) || em.Status != status || (len(em.Errors) > 0 && em.Errors[0].Location == "query.confirm_override") {
		t.Fatalf("want a %d no confirmation can lift, got %v", status, err)
	}
}

func (f *fixture) dryRun(a middleware.Actor) context.Context {
	return middleware.WithIntent(f.as(a), middleware.Intent{DryRun: true})
}

func (f *fixture) overrides(op workflow.Op) []models.WorkflowOverride {
	var rows []models.WorkflowOverride
	f.must(f.db.Where("cycle_id = ? AND op = ?", f.cycleA, op).Order("created_at").Order("id").Find(&rows).Error)
	return rows
}

func (f *fixture) releasedFor(role string, step models.Step) bool {
	var n int64
	f.must(f.db.Model(&models.OpeningStep{}).Where("cycle_id = ? AND role_id = ? AND step = ? AND released_at IS NOT NULL", f.cycleA, role, step).Count(&n).Error)
	return n > 0
}

func (f *fixture) intoReviews() {
	f.closeApplications()
	_, err := f.advance(f.as(f.chiefA), models.StepApplications, &f.roleA, f.apps...)
	f.must(err)
}

func TestScenarioDryRunPreviewsWithoutChanging(t *testing.T) {
	f := newFixture(t)
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	in := &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications}

	out, err := f.s.release(f.dryRun(f.chiefA), in)
	f.must(err)
	if p := out.Body.Preview; p == nil || p.Applied || len(p.Summary) == 0 {
		t.Fatalf("dry run preview: %+v", p)
	}
	if f.releasedFor(f.roleA, models.StepApplications) {
		t.Fatal("a dry run released the step")
	}

	out, err = f.s.release(f.as(f.chiefA), in)
	f.must(err)
	if !out.Body.Preview.Applied || !f.releasedFor(f.roleA, models.StepApplications) {
		t.Fatal("the real release didn't apply")
	}
}

func TestScenarioOverridesNeedConfirmAndAreAudited(t *testing.T) {
	f := newFixture(t)
	f.intoReviews()
	before := len(f.overrides(workflow.OpSetDeadline))
	in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant}
	in.Body.DueAt = f.now.Add(2 * time.Hour)

	_, err := f.s.setDeadline(f.as(f.leadA), in)
	testutil.WantStatus(t, err, http.StatusForbidden)
	_, err = f.s.setDeadline(f.as(f.chiefA), in)
	needsConfirm(t, err)
	confirmedDry := middleware.WithIntent(f.as(f.chiefA), middleware.Intent{Confirm: true, DryRun: true})
	_, err = f.s.setDeadline(confirmedDry, in)
	f.must(err)
	if n := len(f.overrides(workflow.OpSetDeadline)) - before; n != 0 {
		t.Fatalf("a dry run recorded %d overrides", n)
	}

	_, err = f.s.setDeadline(f.confirmed(f.chiefA), in)
	f.must(err)
	rows := f.overrides(workflow.OpSetDeadline)[before:]
	if len(rows) != 1 || rows[0].ActorNUID != f.chiefA.NUID || rows[0].Level != string(workflow.LevelOverride) || len(rows[0].Plan) == 0 {
		t.Fatalf("audit rows: %+v", rows)
	}
}

func TestScenarioStartedStepsStayPut(t *testing.T) {
	f := newFixture(t)
	chief, confirmed := f.as(f.chiefA), f.confirmed(f.chiefA)
	step := func(ctx context.Context, s models.Step, on bool) error {
		in := &SetStepInput{ID: f.cycleA, Step: s}
		in.Body.Enabled = on
		_, err := f.s.setStep(ctx, in)
		return err
	}
	f.intoReviews()

	hardRefusal(t, step(confirmed, models.StepReviews, false), http.StatusConflict)
	needsConfirm(t, step(chief, models.StepInterviews, false))
	f.must(step(confirmed, models.StepInterviews, false))
	needsConfirm(t, step(chief, models.StepInterviews, true))
	f.must(step(confirmed, models.StepInterviews, true))

	_, err := f.s.undo(chief, &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	f.must(err)
	f.must(step(chief, models.StepReviews, false))
	f.must(step(chief, models.StepReviews, true))
}

func TestScenarioUndoNeedsItsStepOn(t *testing.T) {
	f := newFixture(t)
	f.intoReviews()
	f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'applications'", f.cycleA)
	_, err := f.s.undo(f.confirmed(f.chiefA), &UndoInput{ID: f.cycleA, Step: models.StepApplications})
	testutil.WantStatus(t, err, http.StatusConflict)
	if f.stage(f.apps[0]) != models.StageLeadReview {
		t.Fatal("undo moved applicants into a step that is off")
	}
}

func TestScenarioLoweringReviewersKeepsStartedWork(t *testing.T) {
	f := newFixture(t)
	app := f.application(f.cycleA, f.roleA, models.StageLeadReview)
	set := func(ctx context.Context, n int) (*StepsChangeOutput, error) {
		in := &SetAssignmentInput{ID: f.cycleA, Step: models.StepReviews, Kind: models.KindReviewer}
		in.Body.PerApplicant = n
		return f.s.setAssignment(ctx, in)
	}
	_, err := set(f.as(f.chiefA), 3)
	f.must(err)
	for i, nuid := range []string{f.leadA.NUID, f.chiefA.NUID, f.admin.NUID} {
		f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by, assigned_at) VALUES (?, ?, ?, ?)", app, nuid, f.chiefA.NUID, f.now.Add(time.Duration(i)*time.Minute))
	}
	f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid) VALUES (?, ?), (?, ?)", app, f.leadA.NUID, app, f.chiefA.NUID)

	_, err = set(f.as(f.chiefA), 1)
	needsConfirm(t, err)
	preview, err := set(middleware.WithIntent(f.as(f.chiefA), middleware.Intent{Confirm: true, DryRun: true}), 1)
	f.must(err)
	p := preview.Body.Preview
	if len(p.Changes) != 1 || p.Changes[0].Person != f.admin.NUID || len(p.Kept) != 2 || p.Applied {
		t.Fatalf("preview: %+v", p)
	}

	_, err = set(f.confirmed(f.chiefA), 1)
	f.must(err)
	var left []string
	f.must(f.db.Model(&models.LeadAssignment{}).Where("application_id = ?", app).Order("lead_nuid").Pluck("lead_nuid", &left).Error)
	if len(left) != 2 {
		t.Fatalf("only the unstarted reviewer should go, left %v", left)
	}
}

func TestScenarioPeerReviewRelease(t *testing.T) {
	f := newFixture(t)
	set := func(ctx context.Context, released bool) (*ReviewGatesChangeOutput, error) {
		in := &SetPeerReleaseInput{ID: f.cycleA}
		in.Body.RoleID, in.Body.Kind, in.Body.Released = f.roleA, models.ReviewKindWritten, released
		return f.s.setPeerRelease(ctx, in)
	}
	_, err := set(f.as(f.leadA), true)
	testutil.WantStatus(t, err, http.StatusForbidden)
	out, err := set(f.as(f.chiefA), true)
	f.must(err)
	released := false
	for _, g := range out.Body.Gates {
		released = released || (g.RoleID == f.roleA && g.Kind == models.ReviewKindWritten && g.Released)
	}
	if !released {
		t.Fatalf("gates: %+v", out.Body.Gates)
	}
	_, err = set(f.as(f.chiefA), false)
	needsConfirm(t, err)
	_, err = set(f.confirmed(f.chiefA), false)
	f.must(err)
	if len(f.overrides(workflow.OpReleaseReviews)) != 1 {
		t.Fatal("hiding released reviews again should be audited")
	}
}

func TestScenarioEachTierGetsItsLayer(t *testing.T) {
	f := newFixture(t)
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	view := func(a middleware.Actor) workflow.Overview {
		out, err := f.s.getWorkflow(f.as(a), &CycleInput{ID: f.cycleA})
		f.must(err)
		return out.Body.Overview
	}
	lead := view(f.leadA)
	if lead.Role != "lead" || len(lead.NextActions) != 0 {
		t.Fatalf("lead layer: %+v", lead)
	}
	for _, s := range lead.Steps {
		for _, o := range s.Openings {
			for _, d := range o.Deadlines {
				if d.LateCount != nil {
					t.Fatal("leads don't see late counts")
				}
			}
		}
	}
	chief := view(f.chiefA)
	if chief.Role != "chief" || view(f.admin).Role != "admin" {
		t.Fatalf("roles: %s", chief.Role)
	}
	action := func(v workflow.Overview) *workflow.NextAction {
		for i, a := range v.NextActions {
			if a.RoleID != nil && *a.RoleID == f.roleA && a.Step == models.StepApplications {
				return &v.NextActions[i]
			}
		}
		return nil
	}
	if a := action(chief); a == nil || a.Kind != workflow.ActionPrepare || a.Setup == nil || *a.Setup != workflow.SetupApplicationForm {
		t.Fatalf("a form with no questions should be prepared first: %+v", a)
	}
	f.exec("INSERT INTO questions (cycle_id, question_text) VALUES (?, 'Why us?')", f.cycleA)
	if a := action(view(f.chiefA)); a == nil || a.Kind != workflow.ActionRelease {
		t.Fatalf("with questions the next action is release: %+v", a)
	}

	_, err := f.s.getWorkflow(f.as(f.leadB), &CycleInput{ID: f.cycleA})
	testutil.WantStatus(t, err, http.StatusNotFound)
}

func TestScenarioSetupLocksOnceReleased(t *testing.T) {
	f := newFixture(t)
	svc := workflow.NewService(f.db)
	edit := func(ctx context.Context) error {
		return svc.RequireSetupEditable(ctx, f.cycleA, f.roleA, workflow.SetupInterviewScript)
	}
	f.must(edit(f.as(f.chiefA)))
	f.exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, 'interviews', now())", f.cycleA, f.roleA)
	needsConfirm(t, edit(f.as(f.chiefA)))
	testutil.WantStatus(t, edit(f.as(f.leadA)), http.StatusForbidden)
	f.must(edit(f.confirmed(f.chiefA)))
	if len(f.overrides(workflow.OpEditSetup)) != 1 {
		t.Fatal("editing released setup should be audited")
	}
	f.must(svc.RequireSetupEditable(f.as(f.chiefA), f.cycleA, f.roleA2, workflow.SetupInterviewScript))
	needsConfirm(t, svc.RequireSetupEditable(f.as(f.chiefA), f.cycleA, "", workflow.SetupInterviewLogistics))

	f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'interviews'", f.cycleA)
	hardRefusal(t, edit(f.confirmed(f.chiefA)), http.StatusNotFound)
	testutil.WantStatus(t, svc.RequireSetupVisible(f.as(f.leadA), f.cycleA, workflow.SetupInterviewScript), http.StatusNotFound)
}

func TestScenarioPreferenceListDeadline(t *testing.T) {
	f := newFixture(t)
	svc := workflow.NewService(f.db)
	in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepDecisions, Kind: models.KindPreferenceList}
	in.Body.DueAt = f.now.Add(-time.Minute)
	_, err := f.s.setDeadline(f.as(f.chiefA), in)
	f.must(err)
	edit := func(ctx context.Context) error {
		return svc.RequireOpeningWorkEditable(ctx, f.cycleA, f.roleA, workflow.WorkPreferenceList)
	}
	testutil.WantStatus(t, edit(f.as(f.leadA)), http.StatusForbidden)
	needsConfirm(t, edit(f.as(f.chiefA)))
	f.must(edit(f.confirmed(f.chiefA)))
	f.must(svc.RequireAnyOpeningWorkEditable(f.as(f.leadA), f.cycleA, workflow.WorkPreferenceList))

	_, err = f.s.clearDeadline(f.as(f.chiefA), &DeadlineKindInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepDecisions, Kind: models.KindPreferenceList})
	f.must(err)
	f.must(edit(f.as(f.leadA)))
}

func TestScenarioWorkForAStepThatIsOff(t *testing.T) {
	f := newFixture(t)
	svc := workflow.NewService(f.db)
	f.must(svc.RequireWorkEditable(f.as(f.leadA), f.apps[0], workflow.WorkSelection))
	f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'decisions'", f.cycleA)
	hardRefusal(t, svc.RequireWorkEditable(f.confirmed(f.chiefA), f.apps[0], workflow.WorkSelection), http.StatusNotFound)
	hardRefusal(t, svc.RequireAnyOpeningWorkEditable(f.confirmed(f.chiefA), f.cycleA, workflow.WorkPreferenceList), http.StatusNotFound)
	visible, err := svc.VisibleApplications(f.as(f.leadA), f.apps, workflow.WorkSelection)
	f.must(err)
	if len(visible) != 0 {
		t.Fatalf("selections stay hidden while decisions is off: %v", visible)
	}
}

func TestScenarioClosingEarlyNeedsConfirm(t *testing.T) {
	f := newFixture(t)
	f.openApplications()
	closeNow := func(ctx context.Context) error {
		_, err := f.s.workflow.SetDeadline(ctx, workflow.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant, DueAt: f.now})
		return err
	}
	needsConfirm(t, closeNow(f.as(f.chiefA)))
	if f.stateOf(f.roleA) != workflow.StateOpen {
		t.Fatal("an unconfirmed close must leave applications open")
	}
	f.must(closeNow(f.confirmed(f.chiefA)))
	if f.stateOf(f.roleA) != workflow.StateClosed {
		t.Fatal("a confirmed close shuts applications")
	}
	if len(f.overrides(workflow.OpSetDeadline)) == 0 {
		t.Fatal("closing early should be recorded")
	}
	_, err := f.s.workflow.SetDeadline(f.as(f.chiefA), workflow.DeadlineInput{CycleID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications, Kind: models.KindApplicant, DueAt: f.now.Add(48 * time.Hour)})
	if err == nil {
		return
	}
	needsConfirm(t, err)
}

func (f *fixture) stateOf(role string) workflow.State {
	st, err := f.s.workflow.State(context.Background(), f.cycleA)
	f.must(err)
	return st.State(role, models.StepApplications, time.Now())
}

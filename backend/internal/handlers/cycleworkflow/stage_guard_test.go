package cycleworkflow

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/decision"
	"github.com/GenerateNU/apportal/backend/internal/handlers/draft"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewranking"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func (f *fixture) freeze(role string, next models.Step) {
	f.t.Helper()
	f.exec("INSERT INTO opening_steps (cycle_id, role_id, step, released_at) VALUES (?, ?, ?, now())", f.cycleA, role, next)
}

func (f *fixture) wantStage(app string, want models.ApplicationStage) {
	f.t.Helper()
	if got := f.stage(app); got != want {
		f.t.Fatalf("stage %s, want %s", got, want)
	}
}

func TestPatchStage(t *testing.T) {
	f := newFixture(t)
	apps := application.NewApplicationDB(f.db)
	chief, admin := f.as(f.chiefA), f.confirmed(f.admin)
	set := func(ctx context.Context, app string, to models.ApplicationStage) error {
		_, err := apps.UpdateApplication(ctx, app, application.ApplicationUpdate{Stage: &to})
		return err
	}

	testutil.WantStatus(t, set(chief, f.apps[0], models.StageLeadReview), 409)
	testutil.WantStatus(t, set(admin, f.apps[0], models.StageInterview), 409)
	f.wantStage(f.apps[0], models.StageSubmitted)
	f.must(set(chief, f.apps[0], models.StageRejected))
	testutil.WantStatus(t, set(chief, f.apps[0], models.StageSubmitted), 409)

	f.freeze(f.roleA, models.StepReviews)
	testutil.WantStatus(t, set(chief, f.apps[1], models.StageWithdrawn), 409)
	f.wantStage(f.apps[1], models.StageSubmitted)
	f.must(set(admin, f.apps[1], models.StageWithdrawn))

	iv := f.application(f.cycleA, f.roleA, models.StageInterview)
	f.must(set(chief, iv, models.StageInterviewScheduled))
	f.freeze(f.roleA, models.StepDecisions)
	testutil.WantStatus(t, set(chief, iv, models.StageInterviewConducted), 409)
	testutil.WantStatus(t, set(chief, iv, models.StageAccepted), 409)
	f.wantStage(iv, models.StageInterviewScheduled)
	f.must(set(admin, iv, models.StageInterviewConducted))
}

func TestInterviewWriteupMove(t *testing.T) {
	f := newFixture(t)
	apps := application.NewApplicationDB(f.db)
	moving := f.application(f.cycleA, f.roleA, models.StageInterviewConducted)
	f.must(apps.AdvanceApplicationToInterviewReview(f.as(f.leadA), moving))
	f.wantStage(moving, models.StageInterviewReview)

	frozen := f.application(f.cycleA, f.roleA, models.StageInterview)
	f.freeze(f.roleA, models.StepDecisions)
	testutil.WantStatus(t, apps.AdvanceApplicationToInterviewReview(f.as(f.leadA), frozen), 409)
	f.wantStage(frozen, models.StageInterview)

	settled := f.application(f.cycleA, f.roleA, models.StageSelection)
	f.must(apps.AdvanceApplicationToInterviewReview(f.as(f.leadA), settled))
	f.wantStage(settled, models.StageSelection)
}

func TestDecisionLetterStage(t *testing.T) {
	f := newFixture(t)
	decisions := decision.NewDecisionDB(f.db)
	mark := func(ctx context.Context, app string, sent bool) error {
		_, err := decisions.UpsertDecisionDraft(ctx, app, decision.DecisionDraftUpdate{
			Kind: models.DecisionRejectionGeneric, AuthorNUID: f.chiefA.NUID, MarkSent: &sent, SentBy: f.chiefA.NUID,
		})
		return err
	}
	app := f.application(f.cycleA, f.roleA, models.StageChiefReview)
	f.must(mark(f.as(f.chiefA), app, true))
	f.wantStage(app, models.StageRejected)
	f.must(mark(f.as(f.chiefA), app, false))
	f.wantStage(app, models.StageChiefReview)

	f.freeze(f.roleA, models.StepInterviews)
	testutil.WantStatus(t, mark(f.as(f.chiefA), app, true), 409)
	f.wantStage(app, models.StageChiefReview)
	var sent int64
	f.must(f.db.Table("decision_drafts").Where("application_id = ? AND sent_at IS NOT NULL", app).Count(&sent).Error)
	if sent != 0 {
		t.Fatal("a refused send must roll back the letter")
	}
	f.must(mark(f.confirmed(f.admin), app, true))
	testutil.WantStatus(t, mark(f.as(f.chiefA), app, false), 409)
	f.wantStage(app, models.StageRejected)
}

func TestDraftPickStage(t *testing.T) {
	f := newFixture(t)
	drafts := draft.NewDraftDB(f.db)
	list, board := uuid.NewString(), models.Draft{ID: uuid.NewString(), CycleID: f.cycleA, RoleID: f.roleA, Rounds: 2}
	f.exec("INSERT INTO preference_lists (id, cycle_id, name, created_by) VALUES (?, ?, 'Team', ?)", list, f.cycleA, f.chiefA.NUID)
	f.exec("INSERT INTO drafts (id, cycle_id, role_id, rounds, created_by) VALUES (?, ?, ?, 2, ?)", board.ID, f.cycleA, f.roleA, f.chiefA.NUID)
	f.exec("INSERT INTO draft_teams (draft_id, preference_list_id, position) VALUES (?, ?, 0)", board.ID, list)
	picked := f.application(f.cycleA, f.roleA, models.StageSelection)
	other := f.application(f.cycleA, f.roleA, models.StageSelection)
	chief := f.as(f.chiefA)

	_, err := drafts.MakeDraftPick(chief, board, 0, picked, f.chiefA.NUID)
	f.must(err)
	f.wantStage(picked, models.StageAccepted)

	f.freeze(f.roleA, models.StepFeedback)
	_, err = drafts.MakeDraftPick(chief, board, 0, other, f.chiefA.NUID)
	testutil.WantStatus(t, err, 409)
	f.wantStage(other, models.StageSelection)
	_, err = drafts.ReplaceDraftPick(chief, board, 1, other, f.chiefA.NUID)
	testutil.WantStatus(t, err, 409)
	testutil.WantStatus(t, drafts.RemoveDraftPick(chief, board.ID, 1), 409)
	testutil.WantStatus(t, drafts.ResetDraft(chief, board.ID), 409)
	testutil.WantStatus(t, drafts.DeleteDraft(chief, board.ID), 409)
	f.wantStage(picked, models.StageAccepted)

	f.must(drafts.RemoveDraftPick(f.confirmed(f.admin), board.ID, 1))
	f.wantStage(picked, models.StageSelection)
}

func TestShortlistAdvanceAdminOverride(t *testing.T) {
	f := newFixture(t)
	rules := reviewranking.NewWorkflowRules(f.db)
	app := f.application(f.cycleA, f.roleA, models.StageChiefReview)
	f.closeApplications()
	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepReviews)
	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(-time.Minute))
	f.freeze(f.roleA, models.StepDecisions)

	_, err := rules.Advance(f.as(f.chiefA), f.cycleA, f.roleA, []string{app}, nil)
	testutil.WantStatus(t, err, 409)
	moved, err := rules.Advance(f.confirmed(f.admin), f.cycleA, f.roleA, []string{app}, nil)
	f.must(err)
	if len(moved) != 1 {
		t.Fatalf("moved %v", moved)
	}
	f.wantStage(app, models.StageInterview)
}

func TestReleaseOpensDraftCycle(t *testing.T) {
	f := newFixture(t)
	status := func() models.CycleStatus {
		var s []models.CycleStatus
		f.must(f.db.Model(&models.Cycle{}).Where("id = ?", f.cycleA).Pluck("status", &s).Error)
		return s[0]
	}
	f.exec("UPDATE cycles SET status = 'draft' WHERE id = ?", f.cycleA)
	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	_, err := f.s.release(f.as(f.chiefA), &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepApplications})
	f.must(err)
	if got := status(); got != models.CycleOpen {
		t.Fatalf("status %s after release", got)
	}

	f.exec("UPDATE cycles SET status = 'draft' WHERE id = ?", f.cycleA)
	f.deadline(f.roleA2, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	_, err = f.s.release(f.as(f.chiefA), &OpeningStepInput{ID: f.cycleA, RoleID: f.roleA2, Step: models.StepApplications})
	f.must(err)
	if got := status(); got != models.CycleOpen {
		t.Fatalf("status %s after releasing a second opening", got)
	}

	f.exec("UPDATE cycles SET status = 'closed' WHERE id = ?", f.cycleB)
	f.applied(f.s.workflow.SetDeadline(f.as(f.admin), workflow.DeadlineInput{CycleID: f.cycleB, RoleID: f.roleB, Step: models.StepApplications, Kind: models.KindApplicant, DueAt: f.now.Add(time.Hour), DefaultHard: true}))
	f.applied(f.s.workflow.Release(f.confirmed(f.admin), f.cycleB, f.roleB, models.StepApplications))
	var s []models.CycleStatus
	f.must(f.db.Model(&models.Cycle{}).Where("id = ?", f.cycleB).Pluck("status", &s).Error)
	if s[0] != models.CycleClosed {
		t.Fatalf("a closed cycle stays closed, got %s", s[0])
	}
}

func TestMyWorkflowTasks(t *testing.T) {
	f := newFixture(t)
	f.exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'lead')", f.cycleA, f.leadB.NUID)
	f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)",
		f.apps[0], f.leadA.NUID, f.chiefA.NUID, f.apps[1], f.leadB.NUID, f.chiefA.NUID,
		f.apps[1], f.chiefA.NUID, f.chiefA.NUID, f.apps[0], f.admin.NUID, f.chiefA.NUID)

	tasks := func(who context.Context) []workflow.Task {
		out, err := f.s.getWorkflow(who, &CycleInput{ID: f.cycleA})
		f.must(err)
		return out.Body.Tasks
	}
	for name, who := range map[string]context.Context{"lead": f.as(f.leadA), "other lead": f.as(f.leadB), "chief": f.as(f.chiefA)} {
		got := tasks(who)
		if len(got) != 1 || got[0].Kind != workflow.TaskReview || got[0].Total != 1 {
			t.Fatalf("%s tasks: %+v", name, got)
		}
	}
	if got := tasks(f.as(f.admin)); len(got) != 0 {
		t.Fatalf("an admin off the staff has no tasks, got %+v", got)
	}
	f.exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief')", f.cycleA, f.admin.NUID)
	if got := tasks(f.as(f.admin)); len(got) != 1 || got[0].Total != 1 {
		t.Fatalf("an admin on the staff gets their own tasks, got %+v", got)
	}
}

func TestPatchStagesAllOrNone(t *testing.T) {
	f := newFixture(t)
	apps := application.NewApplicationDB(f.db)
	chief, admin := f.as(f.chiefA), f.confirmed(f.admin)

	f.freeze(f.roleA, models.StepReviews)
	_, err := apps.SetStages(chief, f.apps, models.StageRejected)
	testutil.WantStatus(t, err, 409)
	f.wantStage(f.apps[0], models.StageSubmitted)
	f.wantStage(f.apps[1], models.StageSubmitted)

	moved, err := apps.SetStages(admin, f.apps, models.StageRejected)
	f.must(err)
	if len(moved) != 2 || moved[0].Stage != models.StageRejected {
		t.Fatalf("moved: %+v", moved)
	}
	f.wantStage(f.apps[1], models.StageRejected)

	draft := f.application(f.cycleA, f.roleA, models.StageDraft)
	_, err = apps.SetStages(admin, []string{f.apps[0], draft}, models.StageWithdrawn)
	testutil.WantStatus(t, err, 422)
	f.wantStage(f.apps[0], models.StageRejected)
}

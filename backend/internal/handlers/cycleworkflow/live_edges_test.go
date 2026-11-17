package cycleworkflow

import (
	"net/http"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/handlers/decision"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func (f *fixture) leadTask(role string, kind workflow.TaskKind) (workflow.Status, bool) {
	for _, t := range f.seen(f.leadA).Tasks {
		if t.Kind == kind && (t.RoleID == nil || *t.RoleID == role) {
			return t.Status, true
		}
	}
	return "", false
}

func (f *fixture) chiefOpen(page workflow.Page) bool {
	for _, p := range f.seen(f.chiefA).Phases {
		for _, pg := range p.Pages {
			if pg.Page == page {
				return pg.LockedReason == nil
			}
		}
	}
	return false
}

func (f *fixture) wantTask(role string, kind workflow.TaskKind, want workflow.Status) {
	f.t.Helper()
	got, ok := f.leadTask(role, kind)
	if want == "" {
		if ok {
			f.t.Errorf("lead %s: want no task, got %q", kind, got)
		}
		return
	}
	if got != want {
		f.t.Errorf("lead %s: got %q (present=%v), want %q", kind, got, ok, want)
	}
}

func (f *fixture) wantPage(page workflow.Page, open bool) {
	f.t.Helper()
	if got := f.chiefOpen(page); got != open {
		f.t.Errorf("chief %s open=%v, want %v", page, got, open)
	}
}

func (f *fixture) openApps(role string) {
	f.deadline(role, models.StepApplications, models.KindApplicant, f.now.Add(time.Hour))
	f.release(role, models.StepApplications)
}

func (f *fixture) passApps(role string, apps ...string) {
	f.t.Helper()
	f.deadline(role, models.StepApplications, models.KindApplicant, f.now.Add(-time.Minute))
	_, err := f.advance(f.confirmed(f.chiefA), models.StepApplications, &role, apps...)
	f.must(err)
}

func (f *fixture) complete(s models.Step) {
	f.t.Helper()
	f.must(f.s.workflow.Complete(f.confirmed(f.chiefA), f.cycleA, s))
}

func (f *fixture) openReviews(role string) {
	f.deadline(role, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.release(role, models.StepReviews)
}

func (f *fixture) submitReviews(apps ...string) {
	for _, a := range apps {
		f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now())", a, f.leadA.NUID)
	}
}

func (f *fixture) interview(app, interviewer, recorder string) string {
	f.t.Helper()
	var id string
	f.must(f.db.Raw("INSERT INTO interviews (application_id) VALUES (?) RETURNING id", app).Scan(&id).Error)
	if interviewer != "" {
		f.exec("INSERT INTO interviewers (interview_id, interviewer_nuid, assigned_by) VALUES (?, ?, ?)", id, interviewer, f.chiefA.NUID)
	}
	if recorder != "" {
		f.exec("INSERT INTO interview_reviewers (interview_id, reviewer_nuid, assigned_by) VALUES (?, ?, ?)", id, recorder, f.chiefA.NUID)
	}
	return id
}

// reviewsDone takes roleA's apps through reviews; Next is interviews unless disabled.
func (f *fixture) reviewsDone() {
	f.t.Helper()
	f.openApps(f.roleA)
	for _, a := range f.apps {
		f.assignReviewer(a)
	}
	f.passApps(f.roleA, f.apps...)
	f.complete(models.StepApplications)
	f.openReviews(f.roleA)
	f.submitReviews(f.apps...)
	_, err := f.advance(f.confirmed(f.chiefA), models.StepReviews, &f.roleA, f.apps...)
	f.must(err)
	f.complete(models.StepReviews)
}

// toDecisions takes roleA's apps into selection, interviewed by the lead.
func (f *fixture) toDecisions(onTeam bool) string {
	f.t.Helper()
	f.reviewsDone()
	for _, a := range f.apps {
		f.interview(a, f.leadA.NUID, "")
	}
	f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepInterviews)
	f.exec("UPDATE interviews SET submitted_at = now() WHERE application_id IN ?", f.apps)
	f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(-time.Minute))
	_, err := f.advance(f.confirmed(f.chiefA), models.StepInterviews, &f.roleA, f.apps...)
	f.must(err)
	f.complete(models.StepInterviews)
	var list string
	f.must(f.db.Raw("INSERT INTO preference_lists (cycle_id, name, created_by) VALUES (?, 'Team', ?) RETURNING id", f.cycleA, f.chiefA.NUID).Scan(&list).Error)
	if onTeam {
		f.exec("INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by) VALUES (?, ?, ?)", list, f.leadA.NUID, f.chiefA.NUID)
	}
	return list
}

func (f *fixture) closeLists(roles ...string) {
	for _, r := range roles {
		f.deadline(r, models.StepDecisions, models.KindPreferenceList, f.now.Add(-time.Minute))
	}
}

func TestLiveEdges(t *testing.T) {
	t.Run("01 two positions release reviews independently", func(t *testing.T) {
		f := newFixture(t)
		other := f.application(f.cycleA, f.roleA2, models.StageSubmitted)
		f.openApps(f.roleA)
		f.openApps(f.roleA2)
		f.assignReviewer(f.apps[0])
		f.assignReviewer(other)
		f.passApps(f.roleA, f.apps...)
		f.passApps(f.roleA2, other)
		f.complete(models.StepApplications)
		f.openReviews(f.roleA)
		f.wantTask(f.roleA, workflow.TaskReview, workflow.StatusOpen)
		f.wantTask(f.roleA2, workflow.TaskReview, workflow.StatusLocked)
		f.wantPage(workflow.PageReviewProgress, true)
		t.Logf("Engineer reviews open for the lead, Designer still locked, chief progress page open")
	})

	t.Run("02 lead with no assignments sees no tasks", func(t *testing.T) {
		f := newFixture(t)
		f.openApps(f.roleA)
		f.exec("INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by) VALUES (?, ?, ?)", f.apps[0], f.chiefA.NUID, f.chiefA.NUID)
		f.passApps(f.roleA, f.apps...)
		f.complete(models.StepApplications)
		f.openReviews(f.roleA)
		if tasks := f.seen(f.leadA).Tasks; len(tasks) != 0 {
			t.Errorf("unassigned lead has tasks: %+v", tasks)
		}
		t.Logf("reviews released, unassigned lead sees nothing")
	})

	t.Run("03 releasing reviews needs reviewers then a future deadline", func(t *testing.T) {
		f := newFixture(t)
		f.openApps(f.roleA)
		f.passApps(f.roleA, f.apps...)
		f.complete(models.StepApplications)
		_, err := f.s.workflow.Release(f.confirmed(f.admin), f.cycleA, f.roleA, models.StepReviews)
		testutil.WantStatus(t, err, http.StatusConflict)
		f.assignReviewer(f.apps[0])
		_, err = f.s.workflow.Release(f.confirmed(f.admin), f.cycleA, f.roleA, models.StepReviews)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
		t.Logf("no reviewers: 409; reviewers but no deadline: 422")
	})

	t.Run("04 shortlist opens when the review deadline passes with a review missing", func(t *testing.T) {
		f := newFixture(t)
		f.openApps(f.roleA)
		for _, a := range f.apps {
			f.assignReviewer(a)
		}
		f.passApps(f.roleA, f.apps...)
		f.complete(models.StepApplications)
		f.openReviews(f.roleA)
		f.submitReviews(f.apps[0])
		f.wantPage(workflow.PageShortlist, false)
		f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(-time.Minute))
		f.wantPage(workflow.PageShortlist, true)
		t.Logf("1 of 2 reviews in: shortlist locked until the deadline passes, then open")
	})

	t.Run("05 interviews wait on reviews, then release before the review deadline", func(t *testing.T) {
		f := newFixture(t)
		f.openApps(f.roleA)
		for _, a := range f.apps {
			f.assignReviewer(a)
		}
		f.passApps(f.roleA, f.apps...)
		f.complete(models.StepApplications)
		f.openReviews(f.roleA)
		f.submitReviews(f.apps[0])
		for _, a := range f.apps {
			f.interview(a, f.leadA.NUID, "")
		}
		f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(2*time.Hour))
		_, err := f.s.workflow.Release(f.as(f.chiefA), f.cycleA, f.roleA, models.StepInterviews)
		testutil.WantStatus(t, err, http.StatusConflict)
		f.submitReviews(f.apps[1])
		_, err = f.s.workflow.Release(f.as(f.chiefA), f.cycleA, f.roleA, models.StepInterviews)
		f.must(err)
		t.Logf("reviews missing: 409; all in with the deadline still ahead: released")
	})

	t.Run("06 recording reviewer only", func(t *testing.T) {
		f := newFixture(t)
		f.reviewsDone()
		for _, a := range f.apps {
			f.interview(a, f.chiefA.NUID, f.leadA.NUID)
		}
		f.wantTask(f.roleA, workflow.TaskRecordingReview, workflow.StatusLocked)
		f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(time.Hour))
		f.release(f.roleA, models.StepInterviews)
		f.wantTask(f.roleA, workflow.TaskRecordingReview, workflow.StatusOpen)
		f.wantTask(f.roleA, workflow.TaskInterview, "")
		t.Logf("recording task locked before release, open after; no interview task")
	})

	t.Run("07 lead not on a team", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(false)
		f.wantPage(workflow.PagePreferenceLists, true)
		f.wantTask("", workflow.TaskPreferenceList, "")
		t.Logf("in Decisions, lead off every team has no preference list task")
	})

	t.Run("08 deadline passes without submitting", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(true)
		f.wantTask("", workflow.TaskPreferenceList, workflow.StatusOpen)
		f.closeLists(f.roleA, f.roleA2)
		f.wantTask("", workflow.TaskPreferenceList, workflow.StatusDone)
		testutil.WantStatus(t, f.s.workflow.RequireOpeningWorkEditable(f.as(f.leadA), f.cycleA, f.roleA, workflow.WorkPreferenceList), http.StatusForbidden)
		t.Logf("unsubmitted list: task done once closed, lead edits refused with 403")
	})

	t.Run("09 draft waits on every position's deadline", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(true)
		f.closeLists(f.roleA)
		f.wantPage(workflow.PageDraft, false)
		f.closeLists(f.roleA2)
		f.wantPage(workflow.PageDraft, true)
		t.Logf("one deadline passed: draft locked; both passed: open")
	})

	t.Run("10 a board in setup is hidden from leads", func(t *testing.T) {
		f := newFixture(t)
		list := f.toDecisions(true)
		f.closeLists(f.roleA, f.roleA2)
		var board string
		f.must(f.db.Raw("INSERT INTO drafts (cycle_id, role_id, created_by) VALUES (?, ?, ?) RETURNING id", f.cycleA, f.roleA, f.chiefA.NUID).Scan(&board).Error)
		f.exec("INSERT INTO draft_teams (draft_id, preference_list_id, position) VALUES (?, ?, 0)", board, list)
		f.wantTask(f.roleA, workflow.TaskDraft, "")
		f.exec("UPDATE drafts SET status = 'active' WHERE id = ?", board)
		f.wantTask(f.roleA, workflow.TaskDraft, workflow.StatusOpen)
		t.Logf("setup board: no draft task; active board: open")
	})

	t.Run("11 feedback waits on people still in decisions", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(true)
		_, err := f.s.workflow.Release(f.as(f.chiefA), f.cycleA, f.roleA, models.StepFeedback)
		testutil.WantStatus(t, err, http.StatusConflict)
		t.Logf("2 still in selection: opening Feedback refused with 409")
	})

	t.Run("12 feedback opened for one position", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(true)
		_, _, err := f.s.workflow.Decide(f.confirmed(f.chiefA), f.cycleA, f.roleA, []string{f.apps[0]})
		f.must(err)
		f.wantPage(workflow.PageFeedback, false)
		f.wantTask(f.roleA, workflow.TaskFeedback, workflow.StatusLocked)
		f.release(f.roleA, models.StepFeedback)
		f.wantPage(workflow.PageFeedback, true)
		f.wantTask(f.roleA, workflow.TaskFeedback, workflow.StatusOpen)
		t.Logf("feedback locked until opened for Engineer, then open for chief and lead")
	})

	t.Run("13 interviews turned off", func(t *testing.T) {
		f := newFixture(t)
		f.exec("UPDATE cycle_steps SET enabled = false WHERE cycle_id = ? AND step = 'interviews'", f.cycleA)
		var list string
		f.must(f.db.Raw("INSERT INTO preference_lists (cycle_id, name, created_by) VALUES (?, 'Team', ?) RETURNING id", f.cycleA, f.chiefA.NUID).Scan(&list).Error)
		f.exec("INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by) VALUES (?, ?, ?)", list, f.leadA.NUID, f.chiefA.NUID)
		f.openApps(f.roleA)
		for _, a := range f.apps {
			f.assignReviewer(a)
		}
		f.passApps(f.roleA, f.apps...)
		f.complete(models.StepApplications)
		f.openReviews(f.roleA)
		f.submitReviews(f.apps...)
		f.wantTask("", workflow.TaskPreferenceList, workflow.StatusLocked)
		_, err := f.advance(f.confirmed(f.chiefA), models.StepReviews, &f.roleA, f.apps...)
		f.must(err)
		f.complete(models.StepReviews)
		f.wantTask("", workflow.TaskPreferenceList, workflow.StatusOpen)
		f.wantStage(f.apps[0], models.StageSelection)
		t.Logf("no interviews: reviews go straight to Decisions and preference lists open")
	})

	t.Run("14 decisions complete only when every position is decided", func(t *testing.T) {
		f := newFixture(t)
		f.toDecisions(true)
		designer := f.application(f.cycleA, f.roleA2, models.StageSelection)
		_, _, err := f.s.workflow.Decide(f.confirmed(f.chiefA), f.cycleA, f.roleA, []string{f.apps[0]})
		f.must(err)
		done := func() bool {
			var n int64
			f.must(f.db.Model(&models.CycleStep{}).Where("cycle_id = ? AND step = ? AND completed_at IS NOT NULL", f.cycleA, models.StepDecisions).Count(&n).Error)
			return n == 1
		}
		if done() {
			t.Fatal("decisions completed with a designer still waiting")
		}
		_, _, err = f.s.workflow.Decide(f.confirmed(f.chiefA), f.cycleA, f.roleA2, nil)
		f.must(err)
		if !done() {
			t.Fatal("decisions should complete once both are decided")
		}
		f.wantStage(designer, models.StageRejected)
		t.Logf("Engineer decided: still open; Designer decided too: complete")
	})

	t.Run("15 bulk mark sent only takes unsent no-interview letters", func(t *testing.T) {
		f := newFixture(t)
		generic := f.application(f.cycleA, f.roleA, models.StageSelection)
		sent := f.application(f.cycleA, f.roleA, models.StageRejected)
		post := f.application(f.cycleA, f.roleA, models.StageSelection)
		f.interview(post, f.leadA.NUID, "")
		f.exec("INSERT INTO decision_drafts (application_id, kind, sent_at, sent_by) VALUES (?, 'rejection_generic', now(), ?)", sent, f.chiefA.NUID)
		n, err := decision.NewDecisionDB(f.db).MarkGenericSent(f.as(f.chiefA), f.cycleA, []string{generic, sent, post}, f.chiefA.NUID)
		f.must(err)
		if n != 1 {
			t.Fatalf("marked %d, want 1", n)
		}
		f.wantStage(generic, models.StageRejected)
		f.wantStage(post, models.StageSelection)
		var prev string
		f.must(f.db.Raw("SELECT previous_stage FROM decision_drafts WHERE application_id = ?", generic).Scan(&prev).Error)
		if prev != string(models.StageSelection) {
			t.Fatalf("previous_stage %q", prev)
		}
		var posts int64
		f.must(f.db.Raw("SELECT count(*) FROM decision_drafts WHERE application_id = ?", post).Scan(&posts).Error)
		if posts != 0 {
			t.Fatal("a post-interview letter was touched")
		}
		t.Logf("3 sent in: 1 marked, the already-sent and the interviewed one skipped")
	})

	t.Run("16 a closed preference deadline can't move", func(t *testing.T) {
		f := newFixture(t)
		in := &SetDeadlineInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepDecisions, Kind: models.KindPreferenceList}
		in.Body.DueAt = f.now.Add(-time.Minute)
		_, err := f.s.setDeadline(f.as(f.chiefA), in)
		f.must(err)
		in.Body.DueAt = f.now.Add(time.Hour)
		_, err = f.s.setDeadline(f.confirmed(f.chiefA), in)
		testutil.WantStatus(t, err, http.StatusConflict)
		_, err = f.s.clearDeadline(f.confirmed(f.chiefA), &DeadlineKindInput{ID: f.cycleA, RoleID: f.roleA, Step: models.StepDecisions, Kind: models.KindPreferenceList})
		testutil.WantStatus(t, err, http.StatusConflict)
		t.Logf("closed lists: moving or clearing the deadline refused with 409, even confirmed")
	})
}

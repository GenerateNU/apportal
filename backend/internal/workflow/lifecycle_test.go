package workflow

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type leadView map[TaskKind]Status

func leadTasks(f *CycleState, counts []TaskCount) leadView {
	out := leadView{}
	for _, t := range f.Tasks(counts, now) {
		out[t.Kind] = t.Status
	}
	return out
}

func wantLead(t *testing.T, stage string, got leadView, want leadView) {
	t.Helper()
	for k, w := range want {
		if got[k] != w {
			t.Errorf("%s: lead %s is %q, want %q", stage, k, got[k], w)
		}
	}
}

func wantChief(t *testing.T, stage string, f *CycleState, step string, page Page, open bool) {
	t.Helper()
	r, ok := pageLock(f.Phases(now), step, page)
	if !ok {
		t.Errorf("%s: chief page %s missing", stage, page)
		return
	}
	if open && r != "" {
		t.Errorf("%s: chief %s should be open, locked with %q", stage, page, r)
	}
	if !open && r == "" {
		t.Errorf("%s: chief %s should be locked", stage, page)
	}
}

// One opening walked through the whole cycle, checking what a chief and a lead
// can open at each step.
func TestLifecycleUnlocksForChiefsAndLeads(t *testing.T) {
	f := newTestFacts()
	reviews, interviews := string(models.StepReviews), string(models.StepInterviews)
	decisions, feedback := string(models.StepDecisions), string(models.StepFeedback)
	counts := []TaskCount{
		{Kind: TaskReview, RoleID: swe, Total: 3},
		{Kind: TaskInterview, RoleID: swe, Total: 2},
		{Kind: TaskRecordingReview, RoleID: swe, Total: 1},
		{Kind: TaskPreferenceList, Total: 1},
		{Kind: TaskFeedback, RoleID: swe, Total: 1},
	}
	draft := TaskCount{Kind: TaskDraft, RoleID: swe, Total: 1}

	stage := "applications open"
	f.SetRelease(swe, models.StepApplications, past)
	wantChief(t, stage, f, string(models.StepApplications), PageApplicants, true)
	wantLead(t, stage, leadTasks(f, counts), leadView{
		TaskReview: StatusLocked, TaskInterview: StatusLocked, TaskRecordingReview: StatusLocked,
		TaskPreferenceList: StatusLocked, TaskFeedback: StatusLocked,
	})

	stage = "applications closed, reviews not released"
	f.CompletedAt[models.StepApplications] = &past
	wantChief(t, stage, f, reviews, PageAssignReviewers, true)
	wantChief(t, stage, f, reviews, PageReviewProgress, false)
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskReview: StatusLocked})

	stage = "reviews released"
	f.SetRelease(swe, models.StepReviews, past)
	f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future})
	wantChief(t, stage, f, reviews, PageReviewProgress, true)
	wantChief(t, stage, f, reviews, PageShortlist, false)
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskReview: StatusOpen, TaskInterview: StatusLocked})

	stage = "every review in"
	counts[0].Done = 3
	f.Reviews = ReviewProgress{Assigned: 3, Submitted: 3}
	wantChief(t, stage, f, reviews, PageShortlist, true)
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskReview: StatusDone, TaskInterview: StatusLocked})

	stage = "reviews done, interviews not released"
	f.CompletedAt[models.StepReviews] = &past
	wantChief(t, stage, f, interviews, PageAssignInterviewers, true)
	wantChief(t, stage, f, interviews, PageInterviewProgress, false)
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskInterview: StatusLocked, TaskRecordingReview: StatusLocked})

	stage = "interviews released"
	f.SetRelease(swe, models.StepInterviews, past)
	wantChief(t, stage, f, interviews, PageInterviewProgress, true)
	wantLead(t, stage, leadTasks(f, counts), leadView{
		TaskInterview: StatusOpen, TaskRecordingReview: StatusOpen, TaskPreferenceList: StatusLocked,
	})

	stage = "interviews done"
	counts[1].Done, counts[2].Done = 2, 1
	f.CompletedAt[models.StepInterviews] = &past
	wantChief(t, stage, f, decisions, PagePreferenceLists, true)
	wantChief(t, stage, f, decisions, PageDraft, false)
	wantLead(t, stage, leadTasks(f, counts), leadView{
		TaskInterview: StatusDone, TaskRecordingReview: StatusDone, TaskPreferenceList: StatusOpen,
	})

	stage = "list submitted, deadline not passed"
	counts[3].Done = 1
	f.SetDeadline(swe, models.StepDecisions, Deadline{Kind: models.KindPreferenceList, DueAt: future})
	wantChief(t, stage, f, decisions, PageDraft, false)
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskPreferenceList: StatusDone})

	stage = "preference lists closed"
	counts[3].Done = 0
	f.SetDeadline(swe, models.StepDecisions, Deadline{Kind: models.KindPreferenceList, DueAt: past})
	wantChief(t, stage, f, decisions, PageDraft, true)
	if _, ok := leadTasks(f, counts)[TaskDraft]; ok {
		t.Errorf("%s: no draft task before a board starts", stage)
	}
	wantLead(t, stage, leadTasks(f, counts), leadView{TaskPreferenceList: StatusDone})

	stage = "draft running"
	withDraft := append(append([]TaskCount{}, counts...), draft)
	wantLead(t, stage, leadTasks(f, withDraft), leadView{TaskDraft: StatusOpen, TaskFeedback: StatusLocked})

	stage = "draft finished"
	withDraft[len(withDraft)-1].Done = 1
	wantLead(t, stage, leadTasks(f, withDraft), leadView{TaskDraft: StatusDone, TaskFeedback: StatusLocked})

	stage = "decisions done, feedback not opened"
	f.CompletedAt[models.StepDecisions] = &past
	wantChief(t, stage, f, feedback, PageFeedback, false)
	wantLead(t, stage, leadTasks(f, withDraft), leadView{TaskFeedback: StatusLocked})

	stage = "feedback opened"
	f.SetRelease(swe, models.StepFeedback, past)
	wantChief(t, stage, f, feedback, PageFeedback, true)
	wantLead(t, stage, leadTasks(f, withDraft), leadView{TaskFeedback: StatusOpen})
}

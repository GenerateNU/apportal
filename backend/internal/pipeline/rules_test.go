package pipeline

import (
	"net/http"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

var (
	now    = time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	past   = now.Add(-time.Hour)
	future = now.Add(time.Hour)
)

const swe = "role-swe"

func newTestFacts() *Facts {
	f := NewFacts("c1")
	f.Openings = []Opening{{RoleID: swe, Name: "Software Engineer"}}
	return f
}

func statusOf(err error) int {
	if err == nil {
		return 0
	}
	if se, ok := err.(huma.StatusError); ok {
		return se.GetStatus()
	}
	return -1
}

func TestDeriveState(t *testing.T) {
	cases := []struct {
		name     string
		released bool
		due      *time.Time
		want     State
	}{
		{"unreleased", false, nil, StateDraft},
		{"unreleased with deadline", false, &future, StateDraft},
		{"released, no deadline", true, nil, StateOpen},
		{"released, future deadline", true, &future, StateOpen},
		{"released, deadline passed", true, &past, StateClosed},
		{"released, due exactly now", true, &now, StateClosed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var d *Deadline
			if tc.due != nil {
				d = &Deadline{DueAt: *tc.due}
			}
			if got := DeriveState(tc.released, d, now); got != tc.want {
				t.Fatalf("got %s, want %s", got, tc.want)
			}
		})
	}
}

func TestExtendingDeadlineReopens(t *testing.T) {
	f := newTestFacts()
	f.SetRelease(swe, models.StepApplications, past)
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
	if got := f.State(swe, models.StepApplications, now); got != StateClosed {
		t.Fatalf("got %s, want closed", got)
	}
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
	if got := f.State(swe, models.StepApplications, now); got != StateOpen {
		t.Fatalf("got %s, want open", got)
	}
}

func TestNextEnabledStep(t *testing.T) {
	cases := []struct {
		name     string
		disabled []models.Step
		from     models.Step
		want     models.Step
		ok       bool
	}{
		{"all on", nil, models.StepApplications, models.StepReviews, true},
		{"skips disabled", []models.Step{models.StepReviews}, models.StepApplications, models.StepInterviews, true},
		{"skips several", []models.Step{models.StepReviews, models.StepInterviews}, models.StepApplications, models.StepDecisions, true},
		{"last step", nil, models.StepFeedback, "", false},
		{"last enabled step", []models.Step{models.StepFeedback}, models.StepDecisions, "", false},
		{"disabled step has no next", []models.Step{models.StepReviews}, models.StepReviews, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			for _, s := range tc.disabled {
				f.Enabled[s] = false
			}
			got, ok := f.Next(tc.from)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("got %q %v, want %q %v", got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestStepStages(t *testing.T) {
	cases := map[models.ApplicationStage]models.Step{
		models.StageSubmitted:          models.StepApplications,
		models.StageLeadReview:         models.StepReviews,
		models.StageChiefReview:        models.StepReviews,
		models.StageInterviewScheduled: models.StepInterviews,
		models.StageInterviewReview:    models.StepInterviews,
		models.StageSelection:          models.StepDecisions,
		models.StageRejected:           models.StepFeedback,
	}
	for stage, want := range cases {
		if got, _ := StepOfStage(stage); got != want {
			t.Errorf("%s: got %s, want %s", stage, got, want)
		}
	}
	for _, stage := range []models.ApplicationStage{models.StageDraft, models.StageWithdrawn} {
		if _, ok := StepOfStage(stage); ok {
			t.Errorf("%s should belong to no step", stage)
		}
	}
	if _, ok := EntryStage(models.StepFeedback); ok {
		t.Error("feedback has no entry stage")
	}
}

func TestKindsPerStep(t *testing.T) {
	if !AssignmentKindValid(models.StepReviews, models.KindReviewer) || AssignmentKindValid(models.StepInterviews, models.KindReviewer) {
		t.Error("reviewer belongs only on reviews")
	}
	if !AssignmentKindValid(models.StepInterviews, models.KindRecordingReviewer) || AssignmentKindValid(models.StepReviews, models.KindInterviewer) {
		t.Error("interviewer and recording_reviewer belong only on interviews")
	}
	if AssignmentKindValid(models.StepApplications, models.KindApplicant) || !DeadlineKindValid(models.StepApplications, models.KindApplicant) {
		t.Error("applicant is a deadline kind, never an assignment")
	}
	if DeadlineKindValid(models.StepDecisions, models.KindReviewer) {
		t.Error("decisions has no deadlines")
	}
}

func TestLock(t *testing.T) {
	type setup func(f *Facts)
	reviewsReleased := func(f *Facts) { f.SetRelease(swe, models.StepReviews, past) }
	movedIntoReviews := func(f *Facts) { f.AddMove(swe, models.StageLeadReview) }
	cases := []struct {
		name  string
		setup setup
		a     Action
		want  int
	}{
		{"toggle before any advance", nil, Action{Op: OpToggleStep, Step: models.StepInterviews}, 0},
		{"toggle after an advance", movedIntoReviews, Action{Op: OpToggleStep, Step: models.StepInterviews}, http.StatusConflict},
		{"toggle a released step", reviewsReleased, Action{Op: OpToggleStep, Step: models.StepReviews}, http.StatusConflict},
		{"assignments before the step starts", nil, Action{Op: OpSetAssignment, Step: models.StepReviews}, 0},
		{"assignments once released", reviewsReleased, Action{Op: OpSetAssignment, Step: models.StepReviews}, http.StatusConflict},
		{"assignments once moved into", movedIntoReviews, Action{Op: OpSetAssignment, Step: models.StepReviews}, http.StatusConflict},
		{"assignments on a later step still open", movedIntoReviews, Action{Op: OpSetAssignment, Step: models.StepInterviews}, 0},
		{"applicant deadline before reviews start", nil, Action{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, 0},
		{"applicant deadline once reviews released", reviewsReleased, Action{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"applicant deadline once moved into reviews", movedIntoReviews, Action{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"admin overrides the freeze", movedIntoReviews, Action{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe, Admin: true}, 0},
		{"freeze is per opening", movedIntoReviews, Action{Op: OpSetDeadline, Step: models.StepApplications, RoleID: "other"}, 0},
		{"release frozen", movedIntoReviews, Action{Op: OpRelease, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"unrelease frozen", movedIntoReviews, Action{Op: OpUnrelease, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"submissions frozen", movedIntoReviews, Action{Op: OpSubmit, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"reviews not frozen by their own start", movedIntoReviews, Action{Op: OpSetDeadline, Step: models.StepReviews, RoleID: swe}, 0},
		{"advance into a step whose successor started", func(f *Facts) { f.AddMove(swe, models.StageInterview) }, Action{Op: OpAdvance, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"advance normally", movedIntoReviews, Action{Op: OpAdvance, Step: models.StepApplications, RoleID: swe}, 0},
		{"undo frozen once the step after started", func(f *Facts) { f.SetRelease(swe, models.StepInterviews, past) }, Action{Op: OpUndo, Step: models.StepReviews, RoleID: swe}, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.Lock(tc.a)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestFreezeFollowsDisabledSteps(t *testing.T) {
	f := newTestFacts()
	f.Enabled[models.StepReviews] = false
	f.AddMove(swe, models.StageInterview)
	if !f.Frozen(swe, models.StepApplications) {
		t.Fatal("applications should freeze once interviews start when reviews are off")
	}
}

func TestReleaseBlock(t *testing.T) {
	cases := []struct {
		name  string
		step  models.Step
		setup func(f *Facts)
		want  int
	}{
		{"applications without a deadline", models.StepApplications, nil, http.StatusUnprocessableEntity},
		{"applications with a past deadline", models.StepApplications, func(f *Facts) {
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
		}, http.StatusUnprocessableEntity},
		{"applications with a future deadline", models.StepApplications, func(f *Facts) {
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
		}, 0},
		{"reviews while applications are open", models.StepReviews, func(f *Facts) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future})
		}, http.StatusConflict},
		{"reviews once applications close", models.StepReviews, func(f *Facts) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future})
		}, 0},
		{"decisions need no deadline, only interviews closed", models.StepDecisions, func(f *Facts) {
			f.SetRelease(swe, models.StepInterviews, past)
			f.SetDeadline(swe, models.StepInterviews, Deadline{Kind: models.KindInterviewer, DueAt: past})
		}, 0},
		{"feedback needs decisions released", models.StepFeedback, nil, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.ReleaseBlock(swe, tc.step, now)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestDeadlineBlock(t *testing.T) {
	f := newTestFacts()
	f.SetDeadline(swe, models.StepInterviews, Deadline{Kind: models.KindInterviewer, DueAt: now})
	cases := []struct {
		name string
		step models.Step
		kind models.StepKind
		due  time.Time
		want int
	}{
		{"recording after interviews", models.StepInterviews, models.KindRecordingReviewer, future, 0},
		{"recording at the interview deadline", models.StepInterviews, models.KindRecordingReviewer, now, http.StatusUnprocessableEntity},
		{"recording before interviews", models.StepInterviews, models.KindRecordingReviewer, past, http.StatusUnprocessableEntity},
		{"wrong kind for step", models.StepReviews, models.KindApplicant, future, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusOf(f.DeadlineBlock(swe, tc.step, tc.kind, tc.due)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
	f.SetDeadline(swe, models.StepInterviews, Deadline{Kind: models.KindRecordingReviewer, DueAt: future})
	if got := statusOf(f.DeadlineBlock(swe, models.StepInterviews, models.KindInterviewer, future.Add(time.Hour))); got != http.StatusUnprocessableEntity {
		t.Fatalf("moving interviews past recording: got %d, want 422", got)
	}
}

func TestAdvanceBlock(t *testing.T) {
	cases := []struct {
		name     string
		step     models.Step
		setup    func(f *Facts)
		complete bool
		want     int
	}{
		{"unreleased", models.StepApplications, nil, false, http.StatusConflict},
		{"applications still open", models.StepApplications, func(f *Facts) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
		}, true, http.StatusConflict},
		{"applications closed", models.StepApplications, func(f *Facts) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
		}, false, 0},
		{"reviews open with work done", models.StepReviews, func(f *Facts) {
			f.SetRelease(swe, models.StepReviews, past)
		}, true, 0},
		{"reviews open with work missing", models.StepReviews, func(f *Facts) {
			f.SetRelease(swe, models.StepReviews, past)
		}, false, http.StatusConflict},
		{"reviews unreleased even with work done", models.StepReviews, nil, true, http.StatusConflict},
		{"decisions released", models.StepDecisions, func(f *Facts) {
			f.SetRelease(swe, models.StepDecisions, past)
		}, false, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.AdvanceBlock(swe, tc.step, now, tc.complete)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestUndoBlock(t *testing.T) {
	base := UndoCandidate{From: models.StepApplications, To: models.StepReviews, Roles: []string{swe}}
	cases := []struct {
		name    string
		c       func(c UndoCandidate) UndoCandidate
		step    models.Step
		release bool
		want    int
	}{
		{"eligible", func(c UndoCandidate) UndoCandidate { return c }, models.StepApplications, false, 0},
		{"already undone", func(c UndoCandidate) UndoCandidate { c.AlreadyUndone = true; return c }, models.StepApplications, false, http.StatusConflict},
		{"from another step", func(c UndoCandidate) UndoCandidate { return c }, models.StepReviews, false, http.StatusConflict},
		{"applicants moved on", func(c UndoCandidate) UndoCandidate { c.StageChanged = true; return c }, models.StepApplications, false, http.StatusConflict},
		{"work started", func(c UndoCandidate) UndoCandidate { c.HasWork = true; return c }, models.StepApplications, false, http.StatusConflict},
		{"target released", func(c UndoCandidate) UndoCandidate { return c }, models.StepApplications, true, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.release {
				f.SetRelease(swe, models.StepReviews, past)
			}
			if got := statusOf(f.UndoBlock(tc.c(base), tc.step)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestSubmissionBlock(t *testing.T) {
	cases := []struct {
		name  string
		setup func(f *Facts)
		admin bool
		want  int
	}{
		{"no deadline", nil, false, 0},
		{"hard deadline passed", func(f *Facts) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past, Hard: true})
		}, false, http.StatusForbidden},
		{"hard deadline passed, admin too", func(f *Facts) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past, Hard: true})
		}, true, http.StatusForbidden},
		{"soft deadline passed", func(f *Facts) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past})
		}, false, 0},
		{"frozen by interviews", func(f *Facts) { f.AddMove(swe, models.StageInterview) }, false, http.StatusConflict},
		{"frozen, admin overrides", func(f *Facts) { f.AddMove(swe, models.StageInterview) }, true, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.SubmissionBlock(swe, models.StepReviews, models.KindReviewer, tc.admin, now)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func TestStepStatusAndCurrent(t *testing.T) {
	f := newTestFacts()
	f.CompletedAt[models.StepApplications] = &past
	f.SetRelease(swe, models.StepInterviews, past)
	want := map[models.Step]Status{
		models.StepApplications: StatusDone,
		models.StepReviews:      StatusOpen,
		models.StepInterviews:   StatusOpen,
		models.StepDecisions:    StatusLocked,
	}
	for s, w := range want {
		if got := f.StepStatus(s); got != w {
			t.Errorf("%s: got %s, want %s", s, got, w)
		}
	}
	if cur, _ := f.Current(); cur != models.StepReviews {
		t.Errorf("current: got %s, want reviews", cur)
	}
}

func TestCompleteBlock(t *testing.T) {
	f := newTestFacts()
	f.SetRelease(swe, models.StepApplications, past)
	f.AddCount(swe, models.StageSubmitted, 2)
	if got := statusOf(f.CompleteBlock(models.StepApplications, now)); got != http.StatusConflict {
		t.Fatalf("applicants left: got %d, want 409", got)
	}
	f.Counts = map[key]int{}
	if got := statusOf(f.CompleteBlock(models.StepApplications, now)); got != 0 {
		t.Fatalf("empty: got %d, want 0", got)
	}
	if got := statusOf(f.CompleteBlock(models.StepReviews, now)); got != http.StatusConflict {
		t.Fatalf("earlier step not done: got %d, want 409", got)
	}
}

func TestNextActions(t *testing.T) {
	sd := "role-sd"
	f := NewFacts("c1")
	f.Openings = []Opening{{RoleID: swe, Name: "Software Engineer"}, {RoleID: sd, Name: "Designer"}}
	f.SetRelease(swe, models.StepApplications, past)
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
	f.AddCount(swe, models.StageSubmitted, 4)
	f.SetDeadline(sd, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
	for _, s := range []models.Step{models.StepInterviews, models.StepDecisions, models.StepFeedback} {
		f.Enabled[s] = false
	}

	got := f.NextActions(now)
	want := []struct {
		step models.Step
		role string
		kind ActionKind
	}{
		{models.StepApplications, sd, ActionRelease},
		{models.StepApplications, swe, ActionAdvance},
		{models.StepReviews, sd, ActionWaiting},
		{models.StepReviews, swe, ActionSetDeadline},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d actions %+v, want %d", len(got), got, len(want))
	}
	for i, w := range want {
		g := got[i]
		if g.Step != w.step || g.RoleID == nil || *g.RoleID != w.role || g.Kind != w.kind {
			t.Errorf("action %d: got %s %v %s, want %s %s %s", i, g.Step, deref(g.RoleID), g.Kind, w.step, w.role, w.kind)
		}
	}
	if got[2].BlockingReason == nil {
		t.Error("waiting needs a reason")
	}
}

func TestNextActionsComplete(t *testing.T) {
	f := newTestFacts()
	f.SetRelease(swe, models.StepApplications, past)
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
	got := f.NextActions(now)
	if len(got) == 0 || got[0].Kind != ActionComplete || got[0].RoleID != nil {
		t.Fatalf("want a cycle-wide complete first, got %+v", got)
	}
}

func TestTaskStatus(t *testing.T) {
	cases := []struct {
		name        string
		released    bool
		done, total int
		want        Status
	}{
		{"unreleased", false, 0, 3, StatusLocked},
		{"unreleased even when done", false, 3, 3, StatusLocked},
		{"in progress", true, 1, 3, StatusOpen},
		{"done", true, 3, 3, StatusDone},
		{"nothing assigned", true, 0, 0, StatusOpen},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := TaskStatus(tc.released, tc.done, tc.total); got != tc.want {
				t.Fatalf("got %s, want %s", got, tc.want)
			}
		})
	}
}

func TestTasks(t *testing.T) {
	f := newTestFacts()
	f.SetRelease(swe, models.StepReviews, past)
	f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future, Hard: true})
	f.Enabled[models.StepDecisions] = false
	tasks := f.Tasks([]TaskCount{
		{Kind: TaskInterview, RoleID: swe, Total: 2, Done: 0},
		{Kind: TaskReview, RoleID: swe, Total: 3, Done: 3},
		{Kind: TaskRecordingReview, RoleID: swe, Total: 0},
		{Kind: TaskPreferenceList, Total: 1},
	})
	if len(tasks) != 2 {
		t.Fatalf("got %+v", tasks)
	}
	if tasks[0].Kind != TaskReview || tasks[0].Status != StatusDone || tasks[0].DueAt == nil || !*tasks[0].Hard {
		t.Errorf("review task: %+v", tasks[0])
	}
	if tasks[1].Kind != TaskInterview || tasks[1].Status != StatusLocked || tasks[1].LockedReason == nil {
		t.Errorf("interview task: %+v", tasks[1])
	}
}

func TestMoveBlock(t *testing.T) {
	interviewsStarted := newTestFacts()
	interviewsStarted.SetRelease(swe, models.StepInterviews, past)
	cases := []struct {
		name     string
		f        *Facts
		from, to models.ApplicationStage
		restore  bool
		admin    bool
		want     int
	}{
		{"no change", newTestFacts(), models.StageLeadReview, models.StageLeadReview, false, false, 0},
		{"within a step", newTestFacts(), models.StageInterview, models.StageInterviewScheduled, false, false, 0},
		{"submitting a draft", newTestFacts(), models.StageDraft, models.StageSubmitted, false, false, 0},
		{"into the next step", newTestFacts(), models.StageSubmitted, models.StageLeadReview, false, false, http.StatusConflict},
		{"skipping steps", newTestFacts(), models.StageLeadReview, models.StageSelection, false, false, http.StatusConflict},
		{"backwards across steps", newTestFacts(), models.StageInterview, models.StageChiefReview, false, false, http.StatusConflict},
		{"cross-step even as admin", newTestFacts(), models.StageSubmitted, models.StageInterview, false, true, http.StatusConflict},
		{"out of a draft past applications", newTestFacts(), models.StageDraft, models.StageLeadReview, false, false, http.StatusConflict},
		{"to an outcome", newTestFacts(), models.StageLeadReview, models.StageRejected, false, false, 0},
		{"withdrawing", newTestFacts(), models.StageSubmitted, models.StageWithdrawn, false, false, 0},
		{"out of an outcome", newTestFacts(), models.StageRejected, models.StageInterview, false, false, http.StatusConflict},
		{"restoring an outcome", newTestFacts(), models.StageRejected, models.StageInterview, true, false, 0},
		{"between outcomes", newTestFacts(), models.StageAccepted, models.StageRejected, false, false, 0},
		{"within a frozen step", interviewsStarted, models.StageLeadReview, models.StageChiefReview, false, false, http.StatusConflict},
		{"within a frozen step as admin", interviewsStarted, models.StageLeadReview, models.StageChiefReview, false, true, 0},
		{"outcome from a frozen step", interviewsStarted, models.StageChiefReview, models.StageRejected, false, false, http.StatusConflict},
		{"outcome from a frozen step as admin", interviewsStarted, models.StageChiefReview, models.StageRejected, false, true, 0},
		{"restoring into a frozen step", interviewsStarted, models.StageRejected, models.StageLeadReview, true, false, http.StatusConflict},
		{"within the step that started", interviewsStarted, models.StageInterview, models.StageInterviewReview, false, false, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statusOf(tc.f.MoveBlock(swe, tc.from, tc.to, tc.restore, tc.admin)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

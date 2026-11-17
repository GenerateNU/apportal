package workflow

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/middleware"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

var (
	now    = time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	past   = now.Add(-time.Hour)
	future = now.Add(time.Hour)
)

const swe = "role-swe"

func newTestFacts() *CycleState {
	f := NewCycleState("c1")
	f.Openings = []Opening{{RoleID: swe, Name: "Software Engineer"}}
	f.HasTeam = true
	f.Assigned[key{swe, models.StepReviews}] = 1
	f.Assigned[key{swe, models.StepInterviews}] = 1
	return f
}

func statusOf(err error) int {
	if err == nil {
		return 0
	}
	var se huma.StatusError
	if errors.As(err, &se) {
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
			if got := deriveState(tc.released, d, now); got != tc.want {
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
	type setup func(f *CycleState)
	reviewsReleased := func(f *CycleState) { f.SetRelease(swe, models.StepReviews, past) }
	movedIntoReviews := func(f *CycleState) { f.AddMove(swe, models.StageLeadReview) }
	cases := []struct {
		name  string
		setup setup
		a     Operation
		want  int
	}{
		{"toggle before any advance", nil, Operation{Op: OpToggleStep, Step: models.StepInterviews}, 0},
		{"toggle after an advance", movedIntoReviews, Operation{Op: OpToggleStep, Step: models.StepInterviews}, http.StatusConflict},
		{"assignments before the step starts", nil, Operation{Op: OpSetAssignment, Step: models.StepReviews}, 0},
		{"assignments once released", reviewsReleased, Operation{Op: OpSetAssignment, Step: models.StepReviews}, http.StatusConflict},
		{"assignments once moved into", movedIntoReviews, Operation{Op: OpSetAssignment, Step: models.StepReviews}, http.StatusConflict},
		{"assignments on a later step still open", movedIntoReviews, Operation{Op: OpSetAssignment, Step: models.StepInterviews}, 0},
		{"applicant deadline before reviews start", nil, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, 0},
		{"applicant deadline once reviews released", reviewsReleased, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"applicant deadline once moved into reviews", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"admin overrides the freeze once confirmed", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe, Caller: confirmedAdmin}, 0},
		{"chief must confirm an override", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe, Caller: Caller{Tier: TierChief}}, http.StatusConflict},
		{"chief overrides once confirmed", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: swe, Caller: Caller{Tier: TierChief, Intent: middleware.Intent{Confirm: true}}}, 0},
		{"freeze is per opening", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepApplications, RoleID: "other"}, 0},
		{"release frozen", movedIntoReviews, Operation{Op: OpRelease, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"unrelease frozen", movedIntoReviews, Operation{Op: OpUnrelease, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"submissions frozen", movedIntoReviews, Operation{Op: OpSubmit, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"reviews not frozen by their own start", movedIntoReviews, Operation{Op: OpSetDeadline, Step: models.StepReviews, RoleID: swe}, 0},
		{"advance into a step whose successor started", func(f *CycleState) { f.AddMove(swe, models.StageInterview) }, Operation{Op: OpAdvance, Step: models.StepApplications, RoleID: swe}, http.StatusConflict},
		{"advance normally", movedIntoReviews, Operation{Op: OpAdvance, Step: models.StepApplications, RoleID: swe}, 0},
		{"undo frozen once the step after started", func(f *CycleState) { f.SetRelease(swe, models.StepInterviews, past) }, Operation{Op: OpUndo, Step: models.StepReviews, RoleID: swe}, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.EnforcePermission(tc.a)); got != tc.want {
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
		setup func(f *CycleState)
		want  int
	}{
		{"applications without a deadline", models.StepApplications, nil, http.StatusUnprocessableEntity},
		{"applications with a past deadline", models.StepApplications, func(f *CycleState) {
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
		}, http.StatusUnprocessableEntity},
		{"applications with a future deadline", models.StepApplications, func(f *CycleState) {
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
		}, 0},
		{"reviews while applications are open", models.StepReviews, func(f *CycleState) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future})
		}, http.StatusConflict},
		{"reviews once applications close", models.StepReviews, func(f *CycleState) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: future})
		}, 0},
		{"decisions need no deadline, only interviews closed", models.StepDecisions, func(f *CycleState) {
			f.SetRelease(swe, models.StepInterviews, past)
			f.SetDeadline(swe, models.StepInterviews, Deadline{Kind: models.KindInterviewer, DueAt: past})
		}, 0},
		{"feedback waits on people still in decisions", models.StepFeedback, func(f *CycleState) {
			f.Counts[key{swe, models.StepDecisions}] = 3
		}, http.StatusConflict},
		{"feedback once nobody is left in decisions", models.StepFeedback, nil, 0},
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
		setup    func(f *CycleState)
		complete bool
		want     int
	}{
		{"unreleased", models.StepApplications, nil, false, http.StatusConflict},
		{"applications still open", models.StepApplications, func(f *CycleState) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: future})
		}, true, http.StatusConflict},
		{"applications closed", models.StepApplications, func(f *CycleState) {
			f.SetRelease(swe, models.StepApplications, past)
			f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
		}, false, 0},
		{"reviews open with work done", models.StepReviews, func(f *CycleState) {
			f.SetRelease(swe, models.StepReviews, past)
		}, true, 0},
		{"reviews open with work missing", models.StepReviews, func(f *CycleState) {
			f.SetRelease(swe, models.StepReviews, past)
		}, false, http.StatusConflict},
		{"reviews unreleased even with work done", models.StepReviews, nil, true, http.StatusConflict},
		{"decisions released", models.StepDecisions, func(f *CycleState) {
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
		{"origin turned off", func(c UndoCandidate) UndoCandidate {
			c.From, c.To = models.StepReviews, models.StepInterviews
			return c
		}, models.StepReviews, false, http.StatusConflict},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.release {
				f.SetRelease(swe, models.StepReviews, past)
			}
			if tc.name == "origin turned off" {
				f.Enabled[models.StepReviews] = false
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
		setup func(f *CycleState)
		admin bool
		want  int
	}{
		{"no deadline", nil, false, 0},
		{"hard deadline passed", func(f *CycleState) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past, Hard: true})
		}, false, http.StatusForbidden},
		{"hard deadline passed, admin overrides once confirmed", func(f *CycleState) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past, Hard: true})
		}, true, 0},
		{"soft deadline passed", func(f *CycleState) {
			f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past})
		}, false, 0},
		{"frozen by interviews", func(f *CycleState) { f.AddMove(swe, models.StageInterview) }, false, http.StatusConflict},
		{"frozen, admin overrides", func(f *CycleState) { f.AddMove(swe, models.StageInterview) }, true, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			if tc.setup != nil {
				tc.setup(f)
			}
			if got := statusOf(f.SubmissionBlock(swe, models.StepReviews, models.KindReviewer, testActor(tc.admin), now)); got != tc.want {
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

func TestStepsLockedWithoutPositions(t *testing.T) {
	f := newTestFacts()
	f.Openings = nil
	for _, s := range f.EnabledSteps() {
		if got := f.StepStatus(s); got != StatusLocked {
			t.Errorf("%s: got %s, want locked", s, got)
		}
	}
}

func TestStepsWaitOnSetup(t *testing.T) {
	for name, unset := range map[string]func(*CycleState){
		"no positions": func(f *CycleState) { f.Openings = nil },
		"no team":      func(f *CycleState) { f.HasTeam = false },
	} {
		f := newTestFacts()
		unset(f)
		for _, s := range f.EnabledSteps() {
			if got := f.StepStatus(s); got != StatusLocked {
				t.Errorf("%s, %s: got %s, want locked", name, s, got)
			}
		}
		f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: now.Add(time.Hour)})
		if got := statusOf(f.ReleaseBlock(swe, models.StepApplications, now)); got != http.StatusConflict {
			t.Errorf("%s: release got %d, want 409", name, got)
		}
	}
}

func TestReleaseNeedsPeopleAssigned(t *testing.T) {
	f := newTestFacts()
	f.Assigned = map[key]int{}
	f.SetRelease(swe, models.StepApplications, past)
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
	f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: now.Add(time.Hour)})
	if got := statusOf(f.ReleaseBlock(swe, models.StepReviews, now)); got != http.StatusConflict {
		t.Fatalf("no reviewers: got %d, want 409", got)
	}
	f.Assigned[key{swe, models.StepReviews}] = 3
	if got := statusOf(f.ReleaseBlock(swe, models.StepReviews, now)); got != 0 {
		t.Fatalf("with reviewers: got %d, want 0", got)
	}
}

func TestInterviewsReleaseOnceEveryReviewIsIn(t *testing.T) {
	f := newTestFacts()
	f.SetRelease(swe, models.StepApplications, past)
	f.SetDeadline(swe, models.StepApplications, Deadline{Kind: models.KindApplicant, DueAt: past})
	f.SetRelease(swe, models.StepReviews, past)
	f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: now.Add(time.Hour)})
	f.SetDeadline(swe, models.StepInterviews, Deadline{Kind: models.KindInterviewer, DueAt: now.Add(48 * time.Hour)})
	f.Assigned[key{swe, models.StepReviews}] = 2
	f.Submitted[key{swe, models.StepReviews}] = 1
	if got := statusOf(f.ReleaseBlock(swe, models.StepInterviews, now)); got != http.StatusConflict {
		t.Fatalf("a review still out: got %d, want 409", got)
	}
	f.Submitted[key{swe, models.StepReviews}] = 2
	if got := statusOf(f.ReleaseBlock(swe, models.StepInterviews, now)); got != 0 {
		t.Fatalf("every review in: got %d, want 0", got)
	}
}

func TestFeedbackWaitsForDecisionsDespiteRejections(t *testing.T) {
	f := newTestFacts()
	f.CompletedAt[models.StepApplications] = &past
	f.CompletedAt[models.StepReviews] = &past
	f.AddMove(swe, models.StageRejected)
	if got := f.StepStatus(models.StepFeedback); got != StatusLocked {
		t.Fatalf("feedback with a rejection mid-cycle: got %s, want locked", got)
	}
	f.CompletedAt[models.StepInterviews] = &past
	f.CompletedAt[models.StepDecisions] = &past
	if got := f.StepStatus(models.StepFeedback); got != StatusOpen {
		t.Fatalf("feedback once decisions are done: got %s, want open", got)
	}
}

func TestRejectionsDontFreezeDecisions(t *testing.T) {
	f := newTestFacts()
	f.AddMove(swe, models.StageRejected)
	if f.Frozen(swe, models.StepDecisions) {
		t.Fatal("a rejection shouldn't freeze decisions")
	}
	f.AddMove(swe, models.StageSelection)
	if !f.Frozen(swe, models.StepInterviews) {
		t.Fatal("moving into decisions still freezes interviews")
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
	f := NewCycleState("c1")
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
			if got := taskStatus(tc.released, tc.done, tc.total); got != tc.want {
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
	}, now)
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
		f        *CycleState
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
			if got := statusOf(tc.f.MoveBlock(swe, tc.from, tc.to, tc.restore, testActor(tc.admin))); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

var confirmedAdmin = Caller{NUID: "admin", Tier: TierAdmin, Intent: middleware.Intent{Confirm: true}}

func testActor(admin bool) Caller {
	if admin {
		return confirmedAdmin
	}
	return Caller{NUID: "lead", Tier: TierLead}
}

func TestValidateReorder(t *testing.T) {
	A, R, I, D, F := models.StepApplications, models.StepReviews, models.StepInterviews, models.StepDecisions, models.StepFeedback
	all := func(off ...models.Step) map[models.Step]bool {
		m := map[models.Step]bool{A: true, R: true, I: true, D: true, F: true}
		for _, s := range off {
			m[s] = false
		}
		return m
	}
	cases := []struct {
		name    string
		started func(f *CycleState)
		order   []models.Step
		enabled map[models.Step]bool
		want    int
	}{
		{"nothing started, swap anything", func(*CycleState) {}, []models.Step{A, I, R, D, F}, all(), 0},
		{"nothing started, drop a step", func(*CycleState) {}, []models.Step{A, R, I, D, F}, all(I), 0},
		{"applications only, move later steps", func(f *CycleState) { f.SetRelease(swe, A, past) }, []models.Step{A, D, I, R, F}, all(), 0},
		{"reviews started, swap later steps", func(f *CycleState) { f.AddMove(swe, models.StageLeadReview) }, []models.Step{A, R, D, I, F}, all(), 0},
		{"reviews started, drop interviews", func(f *CycleState) { f.AddMove(swe, models.StageLeadReview) }, []models.Step{A, R, I, D, F}, all(I), 0},
		{"reviews started, move it back", func(f *CycleState) { f.AddMove(swe, models.StageLeadReview) }, []models.Step{A, I, R, D, F}, all(), http.StatusConflict},
		{"reviews started, turn it off", func(f *CycleState) { f.AddMove(swe, models.StageLeadReview) }, []models.Step{A, R, I, D, F}, all(R), http.StatusConflict},
		{"interviews started, insert reviews before it", func(f *CycleState) {
			f.Enabled[R] = false
			f.AddMove(swe, models.StageInterview)
		}, []models.Step{A, R, I, D, F}, all(), http.StatusConflict},
		{"interviews started, reviews off and after it stays fine", func(f *CycleState) {
			f.Order = []models.Step{A, I, R, D, F}
			f.Enabled[R] = false
			f.AddMove(swe, models.StageInterview)
		}, []models.Step{A, I, R, D, F}, all(), 0},
		{"released but nobody moved still counts", func(f *CycleState) { f.SetRelease(swe, R, past) }, []models.Step{A, I, R, D, F}, all(), http.StatusConflict},
		{"invalid order is a 422 first", func(*CycleState) {}, []models.Step{R, A, I, D, F}, all(), http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newTestFacts()
			tc.started(f)
			if got := statusOf(f.ValidateReorder(tc.order, tc.enabled)); got != tc.want {
				t.Fatalf("got %d, want %d", got, tc.want)
			}
		})
	}
}

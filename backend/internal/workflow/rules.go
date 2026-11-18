package workflow

import (
	"fmt"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

var outcomeStages = []models.ApplicationStage{models.StageAccepted, models.StageRejected, models.StageWithdrawn}

func isOutcome(stage models.ApplicationStage) bool { return slices.Contains(outcomeStages, stage) }

func moveStep(stage models.ApplicationStage) models.Step {
	if stage == models.StageDraft {
		return models.StepApplications
	}
	s, _ := StepOfStage(stage)
	return s
}

// Only a restore (undoing the decision or pick that set it) takes an applicant out of an outcome.
func (f *CycleState) MoveBlock(role string, from, to models.ApplicationStage, restore bool, actor Caller) error {
	op, err := f.moveOp(role, from, to, restore, actor)
	if err != nil || op.Op == "" {
		return err
	}
	return f.EnforcePermission(op)
}

func (f *CycleState) moveOp(role string, from, to models.ApplicationStage, restore bool, actor Caller) (Operation, error) {
	if from == to {
		return Operation{}, nil
	}
	s := moveStep(from)
	switch {
	case isOutcome(from) && !isOutcome(to) && !restore:
		return Operation{}, conflict("an applicant leaves %s only when the decision that set it is undone", from)
	case isOutcome(from):
		s = moveStep(to)
	case !isOutcome(to) && moveStep(to) != s:
		return Operation{}, conflict("moving from %s to %s changes step; advance %s instead", from, to, Label(s))
	}
	return actor.operation(OpMove, s, role), nil
}

func conflict(format string, args ...any) error {
	return huma.Error409Conflict(fmt.Sprintf(format, args...))
}

func invalid(format string, args ...any) error {
	return huma.Error422UnprocessableEntity(fmt.Sprintf(format, args...))
}

// ValidateReorder fixes every step up to the last one that has started; only steps nobody has reached can move or toggle.
func (f *CycleState) ValidateReorder(order []models.Step, enabled map[models.Step]bool) error {
	if err := ValidateOrder(order, enabled); err != nil {
		return invalid("%s", err)
	}
	current := f.EnabledSteps()
	fixed := 0
	for i, s := range current {
		if f.StartedAnywhere(s) {
			fixed = i + 1
		}
	}
	var next []models.Step
	for _, s := range order {
		if enabled[s] {
			next = append(next, s)
		}
	}
	for i, s := range current[:fixed] {
		if i >= len(next) || next[i] != s {
			return conflict("%s has already started, so the steps up to it can't change", Label(current[fixed-1]))
		}
	}
	return nil
}

func (f *CycleState) RequireStepRun(s models.Step) error {
	if !f.Enabled[s] {
		return huma.Error404NotFound(fmt.Sprintf("this cycle doesn't run %s", Label(s)))
	}
	return nil
}

func (f *CycleState) RequireEnabled(s models.Step) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	if !f.Enabled[s] {
		return invalid("%s is turned off for this cycle", Label(s))
	}
	return nil
}

// releaseNeeds is who must be assigned before a step goes out.
var releaseNeeds = map[models.Step]string{
	models.StepReviews:    "reviewers",
	models.StepInterviews: "interviewers",
}

func (f *CycleState) ReleaseBlock(role string, s models.Step, now time.Time) error {
	if !f.SetUp() {
		return conflict("add a position and a recruitment team before releasing %s", Label(s))
	}
	if who, staffed := releaseNeeds[s]; staffed && f.Assigned[key{role, s}] == 0 {
		return conflict("assign %s for %s before releasing %s", who, f.RoleName(role), Label(s))
	}
	if k, ok := MainKind(s); ok {
		d, ok := f.Deadline(role, s, k)
		if !ok || !d.DueAt.After(now) {
			return invalid("set a future %s deadline before releasing %s", k, Label(s))
		}
	}
	if s == models.StepApplications {
		for _, m := range f.Missing[key{role, s}] {
			if m.work == SetupApplicationForm {
				return conflict("add application questions for %s before releasing %s", f.RoleName(role), Label(s))
			}
		}
	}
	if prev, ok := f.Prev(s); ok && !f.Ready(role, prev, now) {
		return conflict("%s must close for %s before %s is released", Label(prev), f.RoleName(role), Label(s))
	}
	return nil
}

func (f *CycleState) DeadlineBlock(role string, s models.Step, k models.StepKind, due time.Time) error {
	if !DeadlineKindValid(s, k) {
		return invalid("%s has no %s deadline", Label(s), k)
	}
	switch k {
	case models.KindRecordingReviewer:
		if iv, ok := f.Deadline(role, s, models.KindInterviewer); ok && !due.After(iv.DueAt) {
			return invalid("the recording_reviewer deadline must be after the interviewer deadline")
		}
	case models.KindInterviewer:
		if rec, ok := f.Deadline(role, s, models.KindRecordingReviewer); ok && !rec.DueAt.After(due) {
			return invalid("the interviewer deadline must be before the recording_reviewer deadline")
		}
	}
	return nil
}

func (f *CycleState) AdvanceBlock(role string, s models.Step, now time.Time, workComplete bool) error {
	if f.Ready(role, s, now) {
		return nil
	}
	if (s == models.StepReviews || s == models.StepInterviews) && f.Released(role, s) && workComplete {
		return nil
	}
	if !f.Released(role, s) {
		return conflict("%s hasn't been released for %s", Label(s), f.RoleName(role))
	}
	return conflict("%s is still open for %s and not all required work is submitted", Label(s), f.RoleName(role))
}

func (f *CycleState) CompleteBlock(s models.Step, now time.Time) error {
	if err := f.RequireEnabled(s); err != nil {
		return err
	}
	for _, earlier := range f.EnabledSteps() {
		if earlier == s {
			break
		}
		if !f.Done(earlier) {
			return conflict("%s must be complete first", Label(earlier))
		}
	}
	if !f.StartedAnywhere(s) {
		return conflict("%s hasn't started", Label(s))
	}
	if _, hasNext := f.Next(s); hasNext {
		if n := f.StepCount(s); n > 0 {
			return conflict("%d applicants are still in %s", n, Label(s))
		}
		return nil
	}
	for _, o := range f.Openings {
		if f.Count(o.RoleID, s) > 0 && !f.Ready(o.RoleID, s, now) {
			return conflict("%s is still open for %s", Label(s), o.Name)
		}
	}
	return nil
}

type Op string

const (
	OpToggleStep     Op = "toggle_step"
	OpSetAssignment  Op = "set_assignment"
	OpSetDeadline    Op = "set_deadline"
	OpReleaseReviews Op = "release_reviews"
	OpEditSetup      Op = "edit_setup"
	OpRelease        Op = "release"
	OpUnrelease      Op = "unrelease"
	OpSubmit         Op = "submit"
	OpAdvance        Op = "advance"
	OpUndo           Op = "undo"
	OpAssign         Op = "assign"
	OpMove           Op = "move"
)

// Step is the step moved out of for OpAdvance, and the step moved into for OpUndo.
type Operation struct {
	Op     Op
	Step   models.Step
	RoleID string
	Caller Caller
	Level  Level
	Reason string
}

func (f *CycleState) blocker(a Operation) error {
	switch a.Op {
	case OpClose:
		if !f.AllDone() {
			return conflict("%s isn't complete yet", Label(a.Step))
		}
	case OpToggleStep:
		if f.AnyMove {
			return conflict("steps can't be turned on or off after the first advance")
		}
	case OpSetAssignment:
		if f.StartedAnywhere(a.Step) {
			return conflict("%s settings are locked once the step starts", Label(a.Step))
		}
	case OpSetDeadline, OpRelease, OpUnrelease, OpSubmit, OpUndo, OpAssign, OpMove, OpReleaseReviews, OpEditSetup:
		if f.Frozen(a.RoleID, a.Step) {
			return f.frozenErr(a.RoleID, a.Step)
		}
	case OpAdvance:
		if next, ok := f.Next(a.Step); ok && f.Frozen(a.RoleID, next) {
			return f.frozenErr(a.RoleID, next)
		}
	}
	return nil
}

func (f *CycleState) frozenErr(role string, s models.Step) error {
	next, _ := f.Next(s)
	return conflict("%s is frozen for %s because %s has started", Label(s), f.RoleName(role), Label(next))
}

type UndoCandidate struct {
	From          models.Step
	To            models.Step
	Roles         []string
	AlreadyUndone bool
	StageChanged  bool
	HasWork       bool
}

func (f *CycleState) UndoBlock(c UndoCandidate, step models.Step) error {
	switch {
	case c.AlreadyUndone:
		return conflict("the latest advance was already undone; only one level of undo is kept")
	case c.From != step:
		return conflict("the latest advance was out of %s, not %s", Label(c.From), Label(step))
	case c.StageChanged:
		return conflict("some applicants have moved since the advance")
	case c.HasWork:
		return conflict("work has started in %s for these applicants", Label(c.To))
	case !f.Enabled[c.From]:
		return conflict("turn %s back on to undo this", Label(c.From))
	}
	for _, role := range c.Roles {
		if f.Released(role, c.To) {
			return conflict("%s has been released for %s", Label(c.To), f.RoleName(role))
		}
	}
	return nil
}

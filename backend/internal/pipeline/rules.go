package pipeline

import (
	"fmt"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type State string

const (
	StateDraft  State = "draft"
	StateOpen   State = "open"
	StateClosed State = "closed"
)

func (State) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{string(StateDraft), string(StateOpen), string(StateClosed)}}
}

type Status string

const (
	StatusLocked Status = "locked"
	StatusOpen   Status = "open"
	StatusDone   Status = "done"
)

func (Status) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{string(StatusLocked), string(StatusOpen), string(StatusDone)}}
}

var labels = map[models.Step]string{
	models.StepApplications: "Applications",
	models.StepReviews:      "Reviews",
	models.StepInterviews:   "Interviews",
	models.StepDecisions:    "Decisions",
	models.StepFeedback:     "Feedback",
}

func Label(s models.Step) string { return labels[s] }

var mainKinds = map[models.Step]models.StepKind{
	models.StepApplications: models.KindApplicant,
	models.StepReviews:      models.KindReviewer,
	models.StepInterviews:   models.KindInterviewer,
}

func MainKind(s models.Step) (models.StepKind, bool) {
	k, ok := mainKinds[s]
	return k, ok
}

var deadlineKinds = map[models.Step][]models.StepKind{
	models.StepApplications: {models.KindApplicant},
	models.StepReviews:      {models.KindReviewer},
	models.StepInterviews:   {models.KindInterviewer, models.KindRecordingReviewer},
}

var assignmentKinds = map[models.Step][]models.StepKind{
	models.StepReviews:    {models.KindReviewer},
	models.StepInterviews: {models.KindInterviewer, models.KindRecordingReviewer},
}

func DeadlineKindValid(s models.Step, k models.StepKind) bool {
	return slices.Contains(deadlineKinds[s], k)
}

func AssignmentKindValid(s models.Step, k models.StepKind) bool {
	return slices.Contains(assignmentKinds[s], k)
}

var stepStages = map[models.Step][]models.ApplicationStage{
	models.StepApplications: {models.StageSubmitted},
	models.StepReviews:      {models.StageLeadReview, models.StageChiefReview},
	models.StepInterviews:   {models.StageInterview, models.StageInterviewScheduled, models.StageInterviewConducted, models.StageInterviewReview},
	models.StepDecisions:    {models.StageSelection},
	models.StepFeedback:     {models.StageAccepted, models.StageRejected},
}

var entryStages = map[models.Step]models.ApplicationStage{
	models.StepReviews:    models.StageLeadReview,
	models.StepInterviews: models.StageInterview,
	models.StepDecisions:  models.StageSelection,
}

func Stages(s models.Step) []models.ApplicationStage { return stepStages[s] }

func EntryStage(s models.Step) (models.ApplicationStage, bool) {
	st, ok := entryStages[s]
	return st, ok
}

func StepOfStage(stage models.ApplicationStage) (models.Step, bool) {
	for _, s := range models.Steps {
		if slices.Contains(stepStages[s], stage) {
			return s, true
		}
	}
	return "", false
}

var outcomeStages = []models.ApplicationStage{models.StageAccepted, models.StageRejected, models.StageWithdrawn}

func IsOutcome(stage models.ApplicationStage) bool { return slices.Contains(outcomeStages, stage) }

func moveStep(stage models.ApplicationStage) models.Step {
	if stage == models.StageDraft {
		return models.StepApplications
	}
	s, _ := StepOfStage(stage)
	return s
}

// Only a restore (undoing the decision or pick that set it) takes an applicant out of an outcome.
func (f *Facts) MoveBlock(role string, from, to models.ApplicationStage, restore, admin bool) error {
	if from == to {
		return nil
	}
	s := moveStep(from)
	switch {
	case IsOutcome(from) && !IsOutcome(to) && !restore:
		return conflict("an applicant leaves %s only when the decision that set it is undone", from)
	case IsOutcome(from):
		s = moveStep(to)
	case !IsOutcome(to) && moveStep(to) != s:
		return conflict("moving from %s to %s changes step; advance %s instead", from, to, Label(s))
	}
	if f.Frozen(role, s) && !admin {
		return f.frozenErr(role, s)
	}
	return nil
}

type Deadline struct {
	Kind  models.StepKind
	DueAt time.Time
	Hard  bool
}

type Opening struct {
	RoleID string
	Name   string
}

type key struct {
	role string
	step models.Step
}

type Facts struct {
	CycleID     string
	Enabled     map[models.Step]bool
	CompletedAt map[models.Step]*time.Time
	Assignments map[models.Step]map[models.StepKind]int
	Openings    []Opening
	Releases    map[key]time.Time
	Deadlines   map[key]map[models.StepKind]Deadline
	MovedInto   map[key]bool
	Counts      map[key]int
	AnyMove     bool
}

func NewFacts(cycleID string) *Facts {
	f := &Facts{
		CycleID:     cycleID,
		Enabled:     map[models.Step]bool{},
		CompletedAt: map[models.Step]*time.Time{},
		Assignments: map[models.Step]map[models.StepKind]int{},
		Releases:    map[key]time.Time{},
		Deadlines:   map[key]map[models.StepKind]Deadline{},
		MovedInto:   map[key]bool{},
		Counts:      map[key]int{},
	}
	for _, s := range models.Steps {
		f.Enabled[s] = true
	}
	return f
}

func (f *Facts) SetRelease(role string, s models.Step, at time.Time) { f.Releases[key{role, s}] = at }

func (f *Facts) SetDeadline(role string, s models.Step, d Deadline) {
	k := key{role, s}
	if f.Deadlines[k] == nil {
		f.Deadlines[k] = map[models.StepKind]Deadline{}
	}
	f.Deadlines[k][d.Kind] = d
}

func (f *Facts) SetAssignment(s models.Step, k models.StepKind, n int) {
	if f.Assignments[s] == nil {
		f.Assignments[s] = map[models.StepKind]int{}
	}
	f.Assignments[s][k] = n
}

func (f *Facts) AddMove(role string, to models.ApplicationStage) {
	if s, ok := StepOfStage(to); ok {
		f.MovedInto[key{role, s}] = true
		f.AnyMove = true
	}
}

func (f *Facts) AddCount(role string, stage models.ApplicationStage, n int) {
	if s, ok := StepOfStage(stage); ok {
		f.Counts[key{role, s}] += n
	}
}

func (f *Facts) EnabledSteps() []models.Step {
	out := []models.Step{}
	for _, s := range models.Steps {
		if f.Enabled[s] {
			out = append(out, s)
		}
	}
	return out
}

func (f *Facts) Next(s models.Step) (models.Step, bool) {
	steps := f.EnabledSteps()
	i := slices.Index(steps, s)
	if i < 0 || i+1 >= len(steps) {
		return "", false
	}
	return steps[i+1], true
}

func (f *Facts) Prev(s models.Step) (models.Step, bool) {
	steps := f.EnabledSteps()
	i := slices.Index(steps, s)
	if i <= 0 {
		return "", false
	}
	return steps[i-1], true
}

func (f *Facts) RoleName(role string) string {
	for _, o := range f.Openings {
		if o.RoleID == role {
			return o.Name
		}
	}
	return role
}

func (f *Facts) ReleasedAt(role string, s models.Step) (time.Time, bool) {
	t, ok := f.Releases[key{role, s}]
	return t, ok
}

func (f *Facts) Released(role string, s models.Step) bool {
	_, ok := f.ReleasedAt(role, s)
	return ok
}

func (f *Facts) Deadline(role string, s models.Step, k models.StepKind) (Deadline, bool) {
	d, ok := f.Deadlines[key{role, s}][k]
	return d, ok
}

func (f *Facts) Count(role string, s models.Step) int { return f.Counts[key{role, s}] }

func (f *Facts) StepCount(s models.Step) int {
	n := 0
	for _, o := range f.Openings {
		n += f.Count(o.RoleID, s)
	}
	return n
}

func DeriveState(released bool, main *Deadline, now time.Time) State {
	switch {
	case !released:
		return StateDraft
	case main != nil && !now.Before(main.DueAt):
		return StateClosed
	}
	return StateOpen
}

func (f *Facts) State(role string, s models.Step, now time.Time) State {
	var main *Deadline
	if k, ok := MainKind(s); ok {
		if d, ok := f.Deadline(role, s, k); ok {
			main = &d
		}
	}
	return DeriveState(f.Released(role, s), main, now)
}

func (f *Facts) Started(role string, s models.Step) bool {
	return f.Released(role, s) || f.MovedInto[key{role, s}]
}

func (f *Facts) StartedAnywhere(s models.Step) bool {
	for k := range f.Releases {
		if k.step == s {
			return true
		}
	}
	for k, moved := range f.MovedInto {
		if moved && k.step == s {
			return true
		}
	}
	return false
}

func (f *Facts) Frozen(role string, s models.Step) bool {
	next, ok := f.Next(s)
	return ok && f.Started(role, next)
}

func (f *Facts) Ready(role string, s models.Step, now time.Time) bool {
	if _, ok := MainKind(s); !ok {
		return f.Released(role, s)
	}
	return f.State(role, s, now) == StateClosed
}

func (f *Facts) Done(s models.Step) bool { return f.CompletedAt[s] != nil }

func (f *Facts) Current() (models.Step, bool) {
	for _, s := range f.EnabledSteps() {
		if !f.Done(s) {
			return s, true
		}
	}
	return "", false
}

func (f *Facts) StepStatus(s models.Step) Status {
	if f.Done(s) {
		return StatusDone
	}
	if cur, ok := f.Current(); (ok && cur == s) || f.StartedAnywhere(s) {
		return StatusOpen
	}
	return StatusLocked
}

func (f *Facts) AllDone() bool {
	_, ok := f.Current()
	return !ok
}

func conflict(format string, args ...any) error {
	return huma.Error409Conflict(fmt.Sprintf(format, args...))
}

func invalid(format string, args ...any) error {
	return huma.Error422UnprocessableEntity(fmt.Sprintf(format, args...))
}

func (f *Facts) RequireEnabled(s models.Step) error {
	if !s.Valid() {
		return invalid("invalid step")
	}
	if !f.Enabled[s] {
		return invalid("%s is turned off for this cycle", Label(s))
	}
	return nil
}

func (f *Facts) ReleaseBlock(role string, s models.Step, now time.Time) error {
	if k, ok := MainKind(s); ok {
		d, ok := f.Deadline(role, s, k)
		if !ok || !d.DueAt.After(now) {
			return invalid("set a future %s deadline before releasing %s", k, Label(s))
		}
	}
	if prev, ok := f.Prev(s); ok && !f.Ready(role, prev, now) {
		return conflict("%s must close for %s before %s is released", Label(prev), f.RoleName(role), Label(s))
	}
	return nil
}

func (f *Facts) DeadlineBlock(role string, s models.Step, k models.StepKind, due time.Time) error {
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

func (f *Facts) AdvanceBlock(role string, s models.Step, now time.Time, workComplete bool) error {
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

func (f *Facts) CompleteBlock(s models.Step, now time.Time) error {
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
	OpToggleStep    Op = "toggle_step"
	OpSetAssignment Op = "set_assignment"
	OpSetDeadline   Op = "set_deadline"
	OpRelease       Op = "release"
	OpUnrelease     Op = "unrelease"
	OpSubmit        Op = "submit"
	OpAdvance       Op = "advance"
	OpUndo          Op = "undo"
	OpAssign        Op = "assign"
)

// Step is the step moved out of for OpAdvance, and the step moved into for OpUndo.
type Action struct {
	Op     Op
	Step   models.Step
	RoleID string
	Admin  bool
}

func (f *Facts) Lock(a Action) error {
	switch a.Op {
	case OpToggleStep:
		if f.AnyMove {
			return conflict("steps can't be turned on or off after the first advance")
		}
		if f.StartedAnywhere(a.Step) {
			return conflict("%s has already started", Label(a.Step))
		}
	case OpSetAssignment:
		if f.StartedAnywhere(a.Step) {
			return conflict("%s settings are locked once the step starts", Label(a.Step))
		}
	case OpSetDeadline, OpRelease, OpUnrelease, OpSubmit, OpUndo, OpAssign:
		if f.Frozen(a.RoleID, a.Step) && !a.Admin {
			return f.frozenErr(a.RoleID, a.Step)
		}
	case OpAdvance:
		if next, ok := f.Next(a.Step); ok && f.Frozen(a.RoleID, next) && !a.Admin {
			return f.frozenErr(a.RoleID, next)
		}
	}
	return nil
}

func (f *Facts) frozenErr(role string, s models.Step) error {
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

func (f *Facts) UndoBlock(c UndoCandidate, step models.Step) error {
	switch {
	case c.AlreadyUndone:
		return conflict("the latest advance was already undone; only one level of undo is kept")
	case c.From != step:
		return conflict("the latest advance was out of %s, not %s", Label(c.From), Label(step))
	case c.StageChanged:
		return conflict("some applicants have moved since the advance")
	case c.HasWork:
		return conflict("work has started in %s for these applicants", Label(c.To))
	}
	for _, role := range c.Roles {
		if f.Released(role, c.To) {
			return conflict("%s has been released for %s", Label(c.To), f.RoleName(role))
		}
	}
	return nil
}

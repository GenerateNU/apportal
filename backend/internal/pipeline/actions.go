package pipeline

import (
	"fmt"
	"sort"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ActionKind string

const (
	ActionSetDeadline ActionKind = "set_deadline"
	ActionRelease     ActionKind = "release"
	ActionAdvance     ActionKind = "advance"
	ActionComplete    ActionKind = "complete"
	ActionWaiting     ActionKind = "waiting"
)

func (ActionKind) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{
		string(ActionSetDeadline), string(ActionRelease), string(ActionAdvance), string(ActionComplete), string(ActionWaiting),
	}}
}

type NextAction struct {
	Step           models.Step      `json:"step"`
	RoleID         *string          `json:"role_id,omitempty"`
	Kind           ActionKind       `json:"kind"`
	DeadlineKind   *models.StepKind `json:"deadline_kind,omitempty"`
	Label          string           `json:"label"`
	BlockingReason *string          `json:"blocking_reason,omitempty"`
}

func (f *Facts) sortedOpenings() []Opening {
	out := append([]Opening(nil), f.Openings...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].RoleID < out[j].RoleID
	})
	return out
}

func (f *Facts) NextActions(now time.Time) []NextAction {
	out := []NextAction{}
	for _, s := range f.EnabledSteps() {
		if f.Done(s) {
			continue
		}
		for _, o := range f.sortedOpenings() {
			if a := f.openingAction(o, s, now); a != nil {
				out = append(out, *a)
			}
		}
		if f.CompleteBlock(s, now) == nil {
			out = append(out, NextAction{Step: s, Kind: ActionComplete, Label: fmt.Sprintf("Mark %s complete", Label(s))})
		}
	}
	return out
}

func (f *Facts) openingAction(o Opening, s models.Step, now time.Time) *NextAction {
	role := o.RoleID
	a := &NextAction{Step: s, RoleID: &role}
	wait := func(reason string) *NextAction {
		a.Kind, a.Label, a.BlockingReason = ActionWaiting, fmt.Sprintf("%s for %s", Label(s), o.Name), &reason
		return a
	}
	setDeadline := func(k models.StepKind) *NextAction {
		a.Kind, a.DeadlineKind = ActionSetDeadline, &k
		a.Label = fmt.Sprintf("Set the %s deadline for %s (%s)", k, Label(s), o.Name)
		return a
	}
	mk, hasMain := MainKind(s)
	state := f.State(role, s, now)
	if state == StateDraft {
		if prev, ok := f.Prev(s); ok && !f.Ready(role, prev, now) {
			return wait(fmt.Sprintf("waiting for %s to close", Label(prev)))
		}
		if hasMain {
			if d, ok := f.Deadline(role, s, mk); !ok || !d.DueAt.After(now) {
				return setDeadline(mk)
			}
		}
		a.Kind, a.Label = ActionRelease, fmt.Sprintf("Release %s for %s", Label(s), o.Name)
		return a
	}
	if state == StateOpen && hasMain {
		d, ok := f.Deadline(role, s, mk)
		if !ok {
			return setDeadline(mk)
		}
		return wait(fmt.Sprintf("open until %s", d.DueAt.UTC().Format(time.RFC3339)))
	}
	n := f.Count(role, s)
	if n == 0 {
		return nil
	}
	next, ok := f.Next(s)
	if !ok {
		return nil
	}
	if _, ok := EntryStage(next); !ok {
		return wait(fmt.Sprintf("%d applicants still need a decision", n))
	}
	a.Kind, a.Label = ActionAdvance, fmt.Sprintf("Advance %d applicants from %s to %s (%s)", n, Label(s), Label(next), o.Name)
	return a
}

type TaskKind string

const (
	TaskReview          TaskKind = "review"
	TaskInterview       TaskKind = "interview"
	TaskRecordingReview TaskKind = "recording_review"
	TaskPreferenceList  TaskKind = "preference_list"
	TaskDraft           TaskKind = "draft"
	TaskFeedback        TaskKind = "feedback"
)

func (TaskKind) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Enum: []any{
		string(TaskReview), string(TaskInterview), string(TaskRecordingReview), string(TaskPreferenceList),
		string(TaskDraft), string(TaskFeedback),
	}}
}

var taskSteps = map[TaskKind]models.Step{
	TaskReview:          models.StepReviews,
	TaskInterview:       models.StepInterviews,
	TaskRecordingReview: models.StepInterviews,
	TaskPreferenceList:  models.StepDecisions,
	TaskDraft:           models.StepDecisions,
	TaskFeedback:        models.StepFeedback,
}

var taskDeadlineKinds = map[TaskKind]models.StepKind{
	TaskReview:          models.KindReviewer,
	TaskInterview:       models.KindInterviewer,
	TaskRecordingReview: models.KindRecordingReviewer,
}

var taskOrder = []TaskKind{TaskReview, TaskInterview, TaskRecordingReview, TaskPreferenceList, TaskDraft, TaskFeedback}

type TaskCount struct {
	Kind   TaskKind
	RoleID string
	Total  int
	Done   int
}

type Task struct {
	Step         models.Step `json:"step"`
	Kind         TaskKind    `json:"kind"`
	RoleID       *string     `json:"role_id,omitempty"`
	RoleName     *string     `json:"role_name,omitempty"`
	Status       Status      `json:"status"`
	Done         int         `json:"done"`
	Total        int         `json:"total"`
	DueAt        *time.Time  `json:"due_at,omitempty"`
	Hard         *bool       `json:"hard,omitempty"`
	LockedReason *string     `json:"locked_reason,omitempty"`
}

func TaskStatus(released bool, done, total int) Status {
	switch {
	case !released:
		return StatusLocked
	case total > 0 && done >= total:
		return StatusDone
	}
	return StatusOpen
}

func (f *Facts) Tasks(counts []TaskCount) []Task {
	out := []Task{}
	for _, c := range counts {
		s := taskSteps[c.Kind]
		if !f.Enabled[s] || c.Total == 0 {
			continue
		}
		t := Task{Step: s, Kind: c.Kind, Done: c.Done, Total: c.Total}
		var released bool
		if c.RoleID == "" {
			for _, o := range f.Openings {
				released = released || f.Released(o.RoleID, s)
			}
		} else {
			role, name := c.RoleID, f.RoleName(c.RoleID)
			t.RoleID, t.RoleName = &role, &name
			released = f.Released(role, s)
			if d, ok := f.Deadline(role, s, taskDeadlineKinds[c.Kind]); ok {
				due, hard := d.DueAt, d.Hard
				t.DueAt, t.Hard = &due, &hard
			}
		}
		t.Status = TaskStatus(released, c.Done, c.Total)
		if !released {
			reason := fmt.Sprintf("%s hasn't been released yet", Label(s))
			t.LockedReason = &reason
		}
		out = append(out, t)
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Kind != b.Kind {
			return indexOf(taskOrder, a.Kind) < indexOf(taskOrder, b.Kind)
		}
		return deref(a.RoleName) < deref(b.RoleName)
	})
	return out
}

func indexOf(order []TaskKind, k TaskKind) int {
	for i, v := range order {
		if v == k {
			return i
		}
	}
	return len(order)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

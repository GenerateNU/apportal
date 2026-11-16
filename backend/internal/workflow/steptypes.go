package workflow

import (
	"fmt"
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type Placement int

const (
	PlaceAnywhere Placement = iota
	PlaceFirst
	PlaceLast
)

type StepType struct {
	Step            models.Step
	Label           string
	Placement       Placement
	Required        bool
	After           []models.Step
	MainKind        models.StepKind
	DeadlineKinds   []models.StepKind
	AssignmentKinds []models.StepKind
	Stages          []models.ApplicationStage
	Entry           models.ApplicationStage
	// ByOutcome steps are reached by setting an outcome (a decision letter), not by advance.
	ByOutcome bool
}

// stepTypes is listed in the default order a new cycle gets.
var stepTypes = []StepType{
	{
		Step: models.StepApplications, Label: "Applications", Placement: PlaceFirst, Required: true,
		MainKind: models.KindApplicant, DeadlineKinds: []models.StepKind{models.KindApplicant},
		Stages: []models.ApplicationStage{models.StageSubmitted},
	},
	{
		Step: models.StepReviews, Label: "Reviews", After: []models.Step{models.StepApplications},
		MainKind: models.KindReviewer, DeadlineKinds: []models.StepKind{models.KindReviewer},
		AssignmentKinds: []models.StepKind{models.KindReviewer},
		Stages:          []models.ApplicationStage{models.StageLeadReview, models.StageChiefReview},
		Entry:           models.StageLeadReview,
	},
	{
		Step: models.StepInterviews, Label: "Interviews", After: []models.Step{models.StepApplications},
		MainKind:        models.KindInterviewer,
		DeadlineKinds:   []models.StepKind{models.KindInterviewer, models.KindRecordingReviewer},
		AssignmentKinds: []models.StepKind{models.KindInterviewer, models.KindRecordingReviewer},
		Stages:          []models.ApplicationStage{models.StageInterview, models.StageInterviewScheduled, models.StageInterviewConducted, models.StageInterviewReview},
		Entry:           models.StageInterview,
	},
	{
		Step: models.StepDecisions, Label: "Decisions", After: []models.Step{models.StepApplications},
		DeadlineKinds: []models.StepKind{models.KindPreferenceList},
		Stages:        []models.ApplicationStage{models.StageSelection},
		Entry:         models.StageSelection,
	},
	{
		Step: models.StepFeedback, Label: "Feedback", Placement: PlaceLast, ByOutcome: true,
		After:  []models.Step{models.StepApplications},
		Stages: []models.ApplicationStage{models.StageAccepted, models.StageRejected},
	},
}

func TypeOf(s models.Step) (StepType, bool) {
	for _, t := range stepTypes {
		if t.Step == s {
			return t, true
		}
	}
	return StepType{}, false
}

func DefaultOrder() []models.Step {
	out := make([]models.Step, len(stepTypes))
	for i, t := range stepTypes {
		out[i] = t.Step
	}
	return out
}

func Label(s models.Step) string {
	t, _ := TypeOf(s)
	return t.Label
}

func MainKind(s models.Step) (models.StepKind, bool) {
	t, _ := TypeOf(s)
	return t.MainKind, t.MainKind != ""
}

func DeadlineKindValid(s models.Step, k models.StepKind) bool {
	t, _ := TypeOf(s)
	return slices.Contains(t.DeadlineKinds, k)
}

func AssignmentKindValid(s models.Step, k models.StepKind) bool {
	t, _ := TypeOf(s)
	return slices.Contains(t.AssignmentKinds, k)
}

func Stages(s models.Step) []models.ApplicationStage {
	t, _ := TypeOf(s)
	return t.Stages
}

func EntryStage(s models.Step) (models.ApplicationStage, bool) {
	t, _ := TypeOf(s)
	return t.Entry, t.Entry != ""
}

func StepOfStage(stage models.ApplicationStage) (models.Step, bool) {
	for _, t := range stepTypes {
		if slices.Contains(t.Stages, stage) {
			return t.Step, true
		}
	}
	return "", false
}

// ValidateOrder accepts an order only if applicants can advance into, and undo out of, every enabled step.
func ValidateOrder(order []models.Step, enabled map[models.Step]bool) error {
	seen := map[models.Step]bool{}
	var on []models.Step
	for _, s := range order {
		t, ok := TypeOf(s)
		switch {
		case !ok:
			return fmt.Errorf("unknown step %s", s)
		case seen[s]:
			return fmt.Errorf("%s appears twice", t.Label)
		case t.Required && !enabled[s]:
			return fmt.Errorf("%s can't be turned off", t.Label)
		}
		seen[s] = true
		if enabled[s] {
			on = append(on, s)
		}
	}
	if len(seen) != len(stepTypes) {
		return fmt.Errorf("every step type must be placed")
	}
	for i, s := range on {
		t, _ := TypeOf(s)
		switch {
		case t.Placement == PlaceFirst && i != 0:
			return fmt.Errorf("%s must come first", t.Label)
		case t.Placement == PlaceLast && i != len(on)-1:
			return fmt.Errorf("%s must come last", t.Label)
		case i > 0 && t.Entry == "" && !t.ByOutcome:
			return fmt.Errorf("nothing moves applicants into %s", t.Label)
		}
		for _, dep := range t.After {
			if enabled[dep] && slices.Index(on, dep) > i {
				return fmt.Errorf("%s must come after %s", t.Label, Label(dep))
			}
		}
	}
	return nil
}

func Ref(s models.Step) models.StepRef {
	return models.StepRef{Step: s, StepLabel: Label(s)}
}

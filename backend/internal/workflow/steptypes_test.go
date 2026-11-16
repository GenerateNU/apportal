package workflow

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func permutations(steps []models.Step) [][]models.Step {
	if len(steps) <= 1 {
		return [][]models.Step{append([]models.Step{}, steps...)}
	}
	var out [][]models.Step
	for i := range steps {
		rest := append(append([]models.Step{}, steps[:i]...), steps[i+1:]...)
		for _, p := range permutations(rest) {
			out = append(out, append([]models.Step{steps[i]}, p...))
		}
	}
	return out
}

func TestEveryValidOrderCanMoveBothWays(t *testing.T) {
	order := DefaultOrder()
	accepted := 0
	for _, perm := range permutations(order) {
		for mask := 0; mask < 1<<len(order); mask++ {
			enabled := map[models.Step]bool{}
			for i, s := range order {
				enabled[s] = mask&(1<<i) != 0
			}
			if ValidateOrder(perm, enabled) != nil {
				continue
			}
			accepted++
			f := NewCycleState("c")
			f.Order = perm
			f.Enabled = enabled
			on := f.EnabledSteps()
			if on[0] != models.StepApplications {
				t.Fatalf("%v starts with %s", perm, on[0])
			}
			for i := 1; i < len(on); i++ {
				ty, _ := TypeOf(on[i])
				if ty.Entry == "" && !ty.ByOutcome {
					t.Fatalf("%v: nothing moves applicants into %s", on, on[i])
				}
				if next, _ := f.Next(on[i-1]); next != on[i] {
					t.Fatalf("%v: next of %s is %s", on, on[i-1], next)
				}
				if prev, _ := f.Prev(on[i]); prev != on[i-1] {
					t.Fatalf("%v: prev of %s is %s", on, on[i], prev)
				}
			}
		}
	}
	if accepted == 0 {
		t.Fatal("no order was accepted")
	}
	if err := ValidateOrder(DefaultOrder(), map[models.Step]bool{models.StepApplications: true, models.StepReviews: true}); err != nil {
		t.Fatalf("default order rejected: %v", err)
	}
}

func TestValidateOrderRejects(t *testing.T) {
	all := map[models.Step]bool{models.StepApplications: true, models.StepReviews: true, models.StepInterviews: true, models.StepDecisions: true, models.StepFeedback: true}
	cases := map[string][]models.Step{
		"applications not first": {models.StepReviews, models.StepApplications, models.StepInterviews, models.StepDecisions, models.StepFeedback},
		"feedback not last":      {models.StepApplications, models.StepFeedback, models.StepReviews, models.StepInterviews, models.StepDecisions},
		"a step twice":           {models.StepApplications, models.StepReviews, models.StepReviews, models.StepDecisions, models.StepFeedback},
		"a step missing":         {models.StepApplications, models.StepReviews, models.StepInterviews, models.StepFeedback},
	}
	for name, order := range cases {
		if ValidateOrder(order, all) == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	off := map[models.Step]bool{models.StepReviews: true}
	if ValidateOrder(DefaultOrder(), off) == nil {
		t.Error("applications turned off: accepted")
	}
}

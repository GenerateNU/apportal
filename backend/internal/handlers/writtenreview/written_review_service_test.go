package writtenreview

import (
	"encoding/json"
	"testing"
)

func TestMissingRequired(t *testing.T) {
	text := func(s string) *string { return &s }
	score := 7
	answers := []ReviewAnswerInput{
		{ReviewQuestionID: "a", Score: &score},
		{ReviewQuestionID: "b", AnswerText: text("  ")},
		{ReviewQuestionID: "c", AnswerOptions: json.RawMessage(`["x"]`)},
		{ReviewQuestionID: "d", AnswerOptions: json.RawMessage(`[]`)},
	}
	if got := missingRequired([]string{"a", "b", "c", "d", "e"}, answers); got != 3 {
		t.Fatalf("missingRequired = %d, want 3", got)
	}
}

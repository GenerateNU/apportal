package writtenreview

import (
	"encoding/json"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
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

func TestOnlyOwn(t *testing.T) {
	cases := []struct {
		released, manager, assigned, submitted, want bool
	}{
		{released: false, want: true},
		{released: false, assigned: true, submitted: true, want: true},
		{released: false, manager: true, want: false},
		{released: true, manager: true, assigned: true, want: false},
		{released: true, assigned: true, submitted: false, want: true},
		{released: true, assigned: true, submitted: true, want: false},
		{released: true, assigned: false, want: false},
	}
	for _, c := range cases {
		if got := onlyOwn(c.released, c.manager, c.assigned, c.submitted); got != c.want {
			t.Errorf("onlyOwn(released=%v, manager=%v, assigned=%v, submitted=%v) = %v, want %v",
				c.released, c.manager, c.assigned, c.submitted, got, c.want)
		}
	}
}

func TestScopeReviews(t *testing.T) {
	review := func(app, nuid string) models.WrittenReviewDetail {
		var d models.WrittenReviewDetail
		d.ApplicationID, d.ReviewerNUID = app, nuid
		return d
	}
	grouped := map[string][]models.WrittenReviewDetail{
		"hidden":    {review("hidden", "me"), review("hidden", "peer")},
		"managed":   {review("managed", "peer")},
		"pending":   {review("pending", "me"), review("pending", "peer")},
		"done":      {review("done", "me"), review("done", "peer")},
		"unrelated": {review("unrelated", "peer")},
	}
	sets := peerSets{
		visible:   map[string]bool{"managed": true, "pending": true, "done": true, "unrelated": true},
		managed:   map[string]bool{"managed": true},
		assigned:  map[string]bool{"hidden": true, "pending": true, "done": true},
		submitted: map[string]bool{"done": true},
	}
	got := scopeReviews(grouped, "me", sets)
	want := map[string]int{"hidden": 1, "managed": 1, "pending": 1, "done": 2, "unrelated": 1}
	for id, n := range want {
		if len(got[id]) != n {
			t.Errorf("%s: got %d reviews, want %d", id, len(got[id]), n)
		}
	}
	for _, id := range []string{"hidden", "pending"} {
		if got[id][0].ReviewerNUID != "me" {
			t.Errorf("%s: kept %s, want own review", id, got[id][0].ReviewerNUID)
		}
	}
}

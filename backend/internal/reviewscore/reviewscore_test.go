package reviewscore

import (
	"math"
	"testing"
)

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func byApp(scores []Score) map[string]Score {
	out := map[string]Score{}
	for _, s := range scores {
		out[s.ApplicationID] = s
	}
	return out
}

func TestRawIsWeightedAverageOfReviews(t *testing.T) {
	got := byApp(Compute([]Rating{
		{ApplicationID: "a", ReviewerNUID: "x", Value: 1, Weight: 3},
		{ApplicationID: "a", ReviewerNUID: "x", Value: 0, Weight: 1},
		{ApplicationID: "a", ReviewerNUID: "y", Value: 0.5, Weight: 1},
	}))
	if !near(got["a"].Raw, (0.75+0.5)/2) || got["a"].Reviews != 2 {
		t.Fatalf("a = %+v, want raw 0.625 from 2 reviews", got["a"])
	}
}

func TestNormalizingPullsGenerousAndHarshRatersTogether(t *testing.T) {
	ratings := []Rating{
		{ApplicationID: "a1", ReviewerNUID: "generous", Value: 1.0, Weight: 1},
		{ApplicationID: "a2", ReviewerNUID: "generous", Value: 0.8, Weight: 1},
		{ApplicationID: "a3", ReviewerNUID: "harsh", Value: 0.4, Weight: 1},
		{ApplicationID: "a4", ReviewerNUID: "harsh", Value: 0.2, Weight: 1},
	}
	got := byApp(Compute(ratings))
	if !(got["a1"].Raw > got["a3"].Raw) {
		t.Fatal("raw scores should favor the generous rater's applicants")
	}
	if !near(got["a1"].Normalized, got["a3"].Normalized) || !near(got["a2"].Normalized, got["a4"].Normalized) {
		t.Fatalf("each rater's top and bottom should line up after normalizing: %+v", got)
	}
	if !(got["a1"].Normalized > got["a2"].Normalized) {
		t.Fatal("normalizing must keep each rater's own ordering")
	}
}

func TestRaterWithOneReviewOrNoSpreadKeepsRawScore(t *testing.T) {
	got := byApp(Compute([]Rating{
		{ApplicationID: "a1", ReviewerNUID: "once", Value: 0.9, Weight: 1},
		{ApplicationID: "a2", ReviewerNUID: "flat", Value: 0.6, Weight: 1},
		{ApplicationID: "a3", ReviewerNUID: "flat", Value: 0.6, Weight: 1},
		{ApplicationID: "a4", ReviewerNUID: "other", Value: 0.1, Weight: 1},
		{ApplicationID: "a5", ReviewerNUID: "other", Value: 0.3, Weight: 1},
	}))
	for _, id := range []string{"a1", "a2", "a3"} {
		if !near(got[id].Normalized, got[id].Raw) {
			t.Errorf("%s normalized %v, want raw %v", id, got[id].Normalized, got[id].Raw)
		}
	}
}

func TestNormalizedStaysInRange(t *testing.T) {
	got := Compute([]Rating{
		{ApplicationID: "a1", ReviewerNUID: "x", Value: 1, Weight: 1},
		{ApplicationID: "a2", ReviewerNUID: "x", Value: 0.9, Weight: 1},
		{ApplicationID: "a3", ReviewerNUID: "y", Value: 0, Weight: 1},
		{ApplicationID: "a4", ReviewerNUID: "y", Value: 1, Weight: 1},
	})
	for _, s := range got {
		if s.Normalized < 0 || s.Normalized > 1 {
			t.Fatalf("%s normalized %v outside 0..1", s.ApplicationID, s.Normalized)
		}
	}
}

func TestScaleRoundTrips(t *testing.T) {
	if !near(Scale(3, 1, 5), 0.5) || !near(Unscale(0.5, 1, 5), 3) {
		t.Fatal("scale/unscale should map 1..5 onto 0..1 and back")
	}
}

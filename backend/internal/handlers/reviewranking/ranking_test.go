package reviewranking

import (
	"math"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func sc(app, reviewer, question string, score, lo, hi int) ScoreRow {
	return ScoreRow{ApplicationID: app, ReviewerNUID: reviewer, ReviewQuestionID: question, Score: score, ScoreMin: lo, ScoreMax: hi}
}

func apps(ids ...string) []AppRow {
	out := make([]AppRow, len(ids))
	for i, id := range ids {
		out[i] = AppRow{ID: id, Stage: models.StageLeadReview}
	}
	return out
}

func order(entries []models.ReviewRankingEntry) []string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = e.ApplicationID
	}
	return out
}

func byID(entries []models.ReviewRankingEntry) map[string]models.ReviewRankingEntry {
	out := map[string]models.ReviewRankingEntry{}
	for _, e := range entries {
		out[e.ApplicationID] = e
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestRankEvensOutHarshAndLenientReviewers(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "harsh", "q", 3, 1, 10), sc("b", "harsh", "q", 1, 1, 10),
		sc("c", "lenient", "q", 10, 1, 10), sc("d", "lenient", "q", 8, 1, 10),
	}
	got := byID(Rank(apps("a", "b", "c", "d"), scores, nil, nil))
	if *got["a"].NormalizedScore != *got["c"].NormalizedScore {
		t.Fatalf("each reviewer's top pick should tie: a=%v c=%v", *got["a"].NormalizedScore, *got["c"].NormalizedScore)
	}
	if *got["a"].NormalizedScore <= *got["d"].NormalizedScore {
		t.Fatalf("harsh reviewer's top pick should beat lenient reviewer's bottom pick")
	}
}

func TestRankComparesAcrossScales(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "r1", "five", 5, 1, 5), sc("b", "r1", "five", 1, 1, 5),
		sc("a", "r1", "ten", 10, 1, 10), sc("b", "r1", "ten", 1, 1, 10),
	}
	got := byID(Rank(apps("a", "b"), scores, nil, nil))
	if *got["a"].ScaledAverage != 1 || *got["b"].ScaledAverage != 0 {
		t.Fatalf("scaled averages: a=%v b=%v", *got["a"].ScaledAverage, *got["b"].ScaledAverage)
	}
	if math.Abs(*got["a"].NormalizedScore-1) > 1e-9 || math.Abs(*got["b"].NormalizedScore+1) > 1e-9 {
		t.Fatalf("normalized: a=%v b=%v", *got["a"].NormalizedScore, *got["b"].NormalizedScore)
	}
}

func TestRankWeighsReviewersEqually(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "r1", "q1", 10, 1, 10), sc("a", "r1", "q2", 10, 1, 10),
		sc("b", "r1", "q1", 1, 1, 10), sc("b", "r1", "q2", 1, 1, 10),
		sc("a", "r2", "q1", 1, 1, 10),
		sc("b", "r2", "q1", 10, 1, 10),
	}
	got := byID(Rank(apps("a", "b"), scores, nil, nil))
	if *got["a"].NormalizedScore != 0 || *got["b"].NormalizedScore != 0 {
		t.Fatalf("one reviewer each way should cancel: a=%v b=%v", *got["a"].NormalizedScore, *got["b"].NormalizedScore)
	}
	if got["a"].ReviewCount != 2 {
		t.Fatalf("review count %d", got["a"].ReviewCount)
	}
}

func TestRankSingleScoreIsNeutral(t *testing.T) {
	got := Rank(apps("a"), []ScoreRow{sc("a", "r1", "q", 7, 1, 10)}, nil, nil)
	if *got[0].NormalizedScore != 0 {
		t.Fatalf("a reviewer with one score has no spread: %v", *got[0].NormalizedScore)
	}
}

func TestRankPutsUnscoredLast(t *testing.T) {
	scores := []ScoreRow{sc("b", "r1", "q", 2, 1, 10), sc("c", "r1", "q", 9, 1, 10)}
	got := Rank(apps("a", "b", "c"), scores, nil, nil)
	if want := []string{"c", "b", "a"}; !equal(order(got), want) {
		t.Fatalf("order %v, want %v", order(got), want)
	}
	if got[2].Rank != nil || got[2].NormalizedScore != nil {
		t.Fatalf("unscored application should have no rank or score")
	}
	if *got[0].Rank != 1 || *got[1].Rank != 2 {
		t.Fatalf("ranks %d %d", *got[0].Rank, *got[1].Rank)
	}
}

func TestRankCutoffs(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "r1", "q", 9, 1, 10), sc("b", "r1", "q", 6, 1, 10),
		sc("c", "r1", "q", 3, 1, 10),
	}
	cases := []struct {
		name   string
		cutoff *models.ReviewCutoff
		want   map[string]bool
	}{
		{"none", nil, map[string]bool{"a": false, "b": false, "c": false, "d": false}},
		{"top 2", &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 2}, map[string]bool{"a": true, "b": true, "c": false, "d": false}},
		{"top more than scored", &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 10}, map[string]bool{"a": true, "b": true, "c": true, "d": false}},
		{"min score 0", &models.ReviewCutoff{Mode: models.CutoffMinScore, Value: 0}, map[string]bool{"a": true, "b": true, "c": false, "d": false}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := byID(Rank(apps("a", "b", "c", "d"), scores, tc.cutoff, nil))
			for id, want := range tc.want {
				if got[id].AboveCutoff != want || got[id].Included != want {
					t.Errorf("%s: above=%v included=%v, want %v", id, got[id].AboveCutoff, got[id].Included, want)
				}
			}
		})
	}
}

func TestRankOverridesBeatCutoff(t *testing.T) {
	scores := []ScoreRow{sc("a", "r1", "q", 9, 1, 10), sc("b", "r1", "q", 3, 1, 10)}
	cutoff := &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 1}
	got := byID(Rank(apps("a", "b", "c"), scores, cutoff, map[string]bool{"a": false, "b": true, "c": true}))
	if got["a"].Included || !got["a"].AboveCutoff || *got["a"].Override {
		t.Errorf("a should be excluded despite clearing the cutoff: %+v", got["a"])
	}
	if !got["b"].Included || got["b"].AboveCutoff {
		t.Errorf("b should be included despite missing the cutoff: %+v", got["b"])
	}
	if !got["c"].Included {
		t.Errorf("an unscored application can still be added by hand")
	}
}

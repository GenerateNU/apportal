package reviewranking

import (
	"math"
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func sc(app, reviewer, question string, score, lo, hi int) ScoreRow {
	return ScoreRow{ApplicationID: app, ReviewerNUID: reviewer, ReviewQuestionID: question, Score: score, ScoreMin: lo, ScoreMax: hi, Ranked: true}
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

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

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
	if !near(*got["a"].NormalizedScore, 1) || !near(*got["b"].NormalizedScore, -1) {
		t.Fatalf("normalized: a=%v b=%v", *got["a"].NormalizedScore, *got["b"].NormalizedScore)
	}
}

func TestRankScaleMapping(t *testing.T) {
	cases := []struct {
		score, lo, hi int
		want          float64
	}{
		{0, 0, 4, 0}, {1, 0, 4, 0.25}, {4, 0, 4, 1},
		{1, 1, 10, 0}, {10, 1, 10, 1}, {4, 1, 7, 0.5},
	}
	for _, c := range cases {
		got := Rank(apps("a"), []ScoreRow{sc("a", "r1", "q", c.score, c.lo, c.hi)}, nil, nil)
		if !near(*got[0].ScaledAverage, c.want) {
			t.Errorf("%d on %d..%d: scaled %v, want %v", c.score, c.lo, c.hi, *got[0].ScaledAverage, c.want)
		}
	}
}

func TestRankAveragesQuestionsWithinAReview(t *testing.T) {
	scores := []ScoreRow{sc("a", "r1", "q1", 10, 1, 10), sc("a", "r1", "q2", 1, 1, 5)}
	got := Rank(apps("a"), scores, nil, nil)
	if got[0].ReviewCount != 1 || !near(*got[0].ScaledAverage, 0.5) {
		t.Fatalf("one review across two questions: count=%d scaled=%v", got[0].ReviewCount, *got[0].ScaledAverage)
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

func TestRankFallsBackToQuestionWhenReviewerHasNoSpread(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "solo", "q", 10, 1, 10),
		sc("b", "r1", "q", 6, 1, 10), sc("c", "r1", "q", 2, 1, 10),
		sc("d", "flat", "q", 3, 1, 10), sc("e", "flat", "q", 3, 1, 10),
	}
	got := Rank(apps("a", "b", "c", "d", "e"), scores, nil, nil)
	if got[0].ApplicationID != "a" || *got[0].NormalizedScore <= 0 {
		t.Fatalf("a perfect score from a one-review reviewer should rank first: %v", order(got))
	}
	m := byID(got)
	if *m["d"].NormalizedScore >= 0 {
		t.Fatalf("a flat reviewer's low scores should compare against the question cohort: %v", *m["d"].NormalizedScore)
	}
	if *m["d"].NormalizedScore != *m["e"].NormalizedScore {
		t.Fatalf("a flat reviewer's identical scores should tie: d=%v e=%v", *m["d"].NormalizedScore, *m["e"].NormalizedScore)
	}
}

func TestRankNoSpreadAnywhereIsNeutral(t *testing.T) {
	scores := []ScoreRow{sc("a", "r1", "q", 7, 1, 10), sc("b", "r2", "q", 7, 1, 10), sc("c", "r1", "q", 7, 1, 10)}
	for _, e := range Rank(apps("a", "b", "c"), scores, nil, nil) {
		if e.NormalizedScore == nil || *e.NormalizedScore != 0 {
			t.Fatalf("all-flat scores should normalize to 0: %+v", e)
		}
	}
}

func TestRankPutsUnscoredLast(t *testing.T) {
	scores := []ScoreRow{sc("b", "r1", "q", 2, 1, 10), sc("c", "r1", "q", 9, 1, 10)}
	got := Rank(apps("a", "b", "c"), scores, nil, nil)
	if want := []string{"c", "b", "a"}; !slices.Equal(order(got), want) {
		t.Fatalf("order %v, want %v", order(got), want)
	}
	if got[2].Rank != nil || got[2].NormalizedScore != nil || got[2].ScaledAverage != nil || got[2].ReviewCount != 0 {
		t.Fatalf("unscored application should have no rank or score: %+v", got[2])
	}
	if *got[0].Rank != 1 || *got[1].Rank != 2 {
		t.Fatalf("ranks %d %d", *got[0].Rank, *got[1].Rank)
	}
}

func TestRankIgnoresScoresForUnknownApplications(t *testing.T) {
	got := Rank(apps("a"), []ScoreRow{sc("a", "r1", "q", 2, 1, 10), sc("gone", "r1", "q", 9, 1, 10)}, nil, nil)
	if len(got) != 1 || got[0].ApplicationID != "a" {
		t.Fatalf("only listed applications are ranked: %v", order(got))
	}
}

func TestRankExcludesUnrankedQuestions(t *testing.T) {
	unranked := sc("b", "r1", "extra", 10, 1, 10)
	unranked.Ranked = false
	onlyUnranked := sc("c", "r1", "extra", 10, 1, 10)
	onlyUnranked.Ranked = false
	scores := []ScoreRow{sc("a", "r1", "q", 9, 1, 10), sc("b", "r1", "q", 3, 1, 10), unranked, onlyUnranked}
	got := byID(Rank(apps("a", "b", "c"), scores, nil, nil))
	if *got["a"].NormalizedScore <= *got["b"].NormalizedScore {
		t.Fatalf("an unranked question must not lift b: a=%v b=%v", *got["a"].NormalizedScore, *got["b"].NormalizedScore)
	}
	if !near(*got["b"].ScaledAverage, 2.0/9) {
		t.Fatalf("b's scaled average should ignore the unranked score: %v", *got["b"].ScaledAverage)
	}
	if got["c"].NormalizedScore != nil || got["c"].ReviewCount != 0 {
		t.Fatalf("a review with only unranked scores doesn't count: %+v", got["c"])
	}
}

func TestRankSkipsDegenerateScale(t *testing.T) {
	got := Rank(apps("a"), []ScoreRow{sc("a", "r1", "q", 5, 5, 5)}, nil, nil)
	if got[0].NormalizedScore != nil {
		t.Fatalf("a zero-width scale can't be mapped: %+v", got[0])
	}
}

func TestRankBreaksTiesByScaledAverageThenID(t *testing.T) {
	scores := []ScoreRow{
		sc("b", "r1", "q", 9, 1, 10), sc("a", "r1", "q", 1, 1, 10),
		sc("d", "r2", "q", 6, 1, 10), sc("c", "r2", "q", 4, 1, 10),
		sc("f", "r3", "q", 9, 1, 10), sc("e", "r3", "q", 1, 1, 10),
	}
	got := Rank(apps("a", "b", "c", "d", "e", "f"), scores, nil, nil)
	if want := []string{"b", "f", "d", "c", "a", "e"}; !slices.Equal(order(got), want) {
		t.Fatalf("order %v, want %v", order(got), want)
	}
	for i, e := range got {
		if *e.Rank != i+1 {
			t.Fatalf("rank %d at %d", *e.Rank, i)
		}
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
		{"top 0", &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 0}, map[string]bool{"a": false, "b": false, "c": false, "d": false}},
		{"min score at b is inclusive", &models.ReviewCutoff{Mode: models.CutoffMinScore, Value: 0}, map[string]bool{"a": true, "b": true, "c": false, "d": false}},
		{"min score just above b", &models.ReviewCutoff{Mode: models.CutoffMinScore, Value: 0.001}, map[string]bool{"a": true, "b": false, "c": false, "d": false}},
		{"min score below everyone", &models.ReviewCutoff{Mode: models.CutoffMinScore, Value: -5}, map[string]bool{"a": true, "b": true, "c": true, "d": false}},
		{"min score above everyone", &models.ReviewCutoff{Mode: models.CutoffMinScore, Value: 5}, map[string]bool{"a": false, "b": false, "c": false, "d": false}},
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

func TestRankOverridesWithoutCutoff(t *testing.T) {
	got := byID(Rank(apps("a", "b"), []ScoreRow{sc("a", "r1", "q", 9, 1, 10)}, nil, map[string]bool{"b": true}))
	if got["a"].Included || got["a"].Override != nil || !got["b"].Included {
		t.Fatalf("without a cutoff only hand-picks are in: %+v %+v", got["a"], got["b"])
	}
}

func TestRankTopNKeepsTies(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "r1", "q", 9, 1, 10), sc("b", "r1", "q", 6, 1, 10),
		sc("c", "r1", "q", 6, 1, 10), sc("d", "r1", "q", 3, 1, 10),
	}
	cases := []struct {
		n    float64
		want map[string]bool
	}{
		{1, map[string]bool{"a": true, "b": false, "c": false, "d": false}},
		{2, map[string]bool{"a": true, "b": true, "c": true, "d": false}},
		{3, map[string]bool{"a": true, "b": true, "c": true, "d": false}},
		{4, map[string]bool{"a": true, "b": true, "c": true, "d": true}},
	}
	for _, tc := range cases {
		got := byID(Rank(apps("a", "b", "c", "d"), scores, &models.ReviewCutoff{Mode: models.CutoffTopN, Value: tc.n}, nil))
		for id, want := range tc.want {
			if got[id].AboveCutoff != want {
				t.Errorf("top %v, %s: above=%v, want %v", tc.n, id, got[id].AboveCutoff, want)
			}
		}
	}
}

func TestRankTopNTieAcrossReviewers(t *testing.T) {
	scores := []ScoreRow{
		sc("a", "r1", "q", 9, 1, 10), sc("b", "r1", "q", 3, 1, 10),
		sc("c", "r2", "q", 8, 1, 10), sc("d", "r2", "q", 2, 1, 10),
	}
	got := byID(Rank(apps("a", "b", "c", "d"), scores, &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 1}, nil))
	if !got["a"].AboveCutoff || !got["c"].AboveCutoff || got["b"].AboveCutoff || got["d"].AboveCutoff {
		t.Fatalf("each reviewer's top pick ties at the cut: %+v", got)
	}
	if *got["a"].Rank != 1 || *got["c"].Rank != 2 {
		t.Fatalf("scaled average breaks the rank tie: a=%d c=%d", *got["a"].Rank, *got["c"].Rank)
	}
}

func TestRankEmpty(t *testing.T) {
	got := Rank(nil, nil, &models.ReviewCutoff{Mode: models.CutoffTopN, Value: 3}, nil)
	if len(got) != 0 {
		t.Fatalf("no applications: %v", got)
	}
}

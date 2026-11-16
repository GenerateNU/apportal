package reviewranking

import (
	"math"
	"sort"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type reviewerQuestion struct{ reviewer, question string }

type review struct{ application, reviewer string }

type runningMean struct {
	sum float64
	n   int
}

func (m *runningMean) add(v float64) { m.sum += v; m.n++ }

func (m runningMean) mean() float64 { return m.sum / float64(m.n) }

type stat struct{ mean, sd float64 }

func newStat(vs []float64) stat {
	var sum float64
	for _, v := range vs {
		sum += v
	}
	mean := sum / float64(len(vs))
	var sq float64
	for _, v := range vs {
		sq += (v - mean) * (v - mean)
	}
	return stat{mean, math.Sqrt(sq / float64(len(vs)))}
}

func rankable(scores []ScoreRow) []ScoreRow {
	out := make([]ScoreRow, 0, len(scores))
	for _, s := range scores {
		if s.Ranked && s.ScoreMax > s.ScoreMin {
			out = append(out, s)
		}
	}
	return out
}

// zScores compares each score with the same reviewer's scores on that
// question, falling back to everyone's when the reviewer gave only one value.
func zScores(scores []ScoreRow) []float64 {
	byReviewer := map[reviewerQuestion][]float64{}
	byQuestion := map[string][]float64{}
	for _, s := range scores {
		k := reviewerQuestion{s.ReviewerNUID, s.ReviewQuestionID}
		byReviewer[k] = append(byReviewer[k], float64(s.Score))
		byQuestion[s.ReviewQuestionID] = append(byQuestion[s.ReviewQuestionID], float64(s.Score))
	}
	reviewerStats := make(map[reviewerQuestion]stat, len(byReviewer))
	for k, vs := range byReviewer {
		reviewerStats[k] = newStat(vs)
	}
	questionStats := make(map[string]stat, len(byQuestion))
	for k, vs := range byQuestion {
		questionStats[k] = newStat(vs)
	}

	z := make([]float64, len(scores))
	for i, s := range scores {
		st := reviewerStats[reviewerQuestion{s.ReviewerNUID, s.ReviewQuestionID}]
		if st.sd == 0 {
			st = questionStats[s.ReviewQuestionID]
		}
		if st.sd > 0 {
			z[i] = (float64(s.Score) - st.mean) / st.sd
		}
	}
	return z
}

// Rank weighs each review once, however many questions it scored.
func Rank(apps []AppRow, scores []ScoreRow, cutoff *models.ReviewCutoff, overrides map[string]bool) []models.ReviewRankingEntry {
	scores = rankable(scores)
	z := zScores(scores)
	reviewZ := map[review]*runningMean{}
	reviewScaled := map[review]*runningMean{}
	var reviewOrder []review
	for i, s := range scores {
		k := review{s.ApplicationID, s.ReviewerNUID}
		if reviewZ[k] == nil {
			reviewZ[k], reviewScaled[k] = &runningMean{}, &runningMean{}
			reviewOrder = append(reviewOrder, k)
		}
		reviewZ[k].add(z[i])
		reviewScaled[k].add(float64(s.Score-s.ScoreMin) / float64(s.ScoreMax-s.ScoreMin))
	}

	appZ := map[string]*runningMean{}
	appScaled := map[string]*runningMean{}
	for _, k := range reviewOrder {
		if appZ[k.application] == nil {
			appZ[k.application], appScaled[k.application] = &runningMean{}, &runningMean{}
		}
		appZ[k.application].add(reviewZ[k].mean())
		appScaled[k.application].add(reviewScaled[k].mean())
	}

	entries := make([]models.ReviewRankingEntry, len(apps))
	for i, a := range apps {
		e := models.ReviewRankingEntry{ApplicationID: a.ID, Stage: a.Stage}
		if m := appZ[a.ID]; m != nil {
			e.ReviewCount = m.n
			e.NormalizedScore = ptr(m.mean())
			e.ScaledAverage = ptr(appScaled[a.ID].mean())
		}
		entries[i] = e
	}

	sort.SliceStable(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if (a.NormalizedScore == nil) != (b.NormalizedScore == nil) {
			return a.NormalizedScore != nil
		}
		if a.NormalizedScore == nil {
			return a.ApplicationID < b.ApplicationID
		}
		if *a.NormalizedScore != *b.NormalizedScore {
			return *a.NormalizedScore > *b.NormalizedScore
		}
		if *a.ScaledAverage != *b.ScaledAverage {
			return *a.ScaledAverage > *b.ScaledAverage
		}
		return a.ApplicationID < b.ApplicationID
	})

	bar := cutoffScore(cutoff, entries)
	for i := range entries {
		e := &entries[i]
		if e.NormalizedScore != nil {
			e.Rank = ptr(i + 1)
			e.AboveCutoff = bar != nil && *e.NormalizedScore >= *bar
		}
		e.Included = e.AboveCutoff
		if inc, ok := overrides[e.ApplicationID]; ok {
			e.Override = ptr(inc)
			e.Included = inc
		}
	}
	return entries
}

// cutoffScore is the lowest score that passes; top N keeps anyone tied with the Nth.
func cutoffScore(c *models.ReviewCutoff, ranked []models.ReviewRankingEntry) *float64 {
	if c == nil {
		return nil
	}
	switch c.Mode {
	case models.CutoffMinScore:
		return ptr(c.Value)
	case models.CutoffTopN:
		n := int(c.Value)
		var last *float64
		for i, e := range ranked {
			if e.NormalizedScore == nil || i >= n {
				break
			}
			last = e.NormalizedScore
		}
		return last
	}
	return nil
}

func ptr[T any](v T) *T { return &v }

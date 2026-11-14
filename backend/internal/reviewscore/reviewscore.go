package reviewscore

import (
	"math"
	"sort"
)

type Rating struct {
	ApplicationID string
	ReviewerNUID  string
	Value         float64
	Weight        float64
}

type Score struct {
	ApplicationID string
	Raw           float64
	Normalized    float64
	Reviews       int
}

type review struct {
	app      string
	reviewer string
	value    float64
}

func Compute(ratings []Rating) []Score {
	reviews := combineReviews(ratings)
	if len(reviews) == 0 {
		return []Score{}
	}

	all := make([]float64, len(reviews))
	byReviewer := map[string][]float64{}
	for i, r := range reviews {
		all[i] = r.value
		byReviewer[r.reviewer] = append(byReviewer[r.reviewer], r.value)
	}
	mean, spread := meanSpread(all)
	type stats struct{ mean, spread float64 }
	reviewerStats := make(map[string]stats, len(byReviewer))
	for nuid, values := range byReviewer {
		m, s := meanSpread(values)
		if len(values) < 2 {
			s = 0
		}
		reviewerStats[nuid] = stats{m, s}
	}

	type acc struct {
		raw, normalized float64
		n               int
	}
	byApp := map[string]*acc{}
	for _, r := range reviews {
		normalized := r.value
		if st := reviewerStats[r.reviewer]; st.spread > 0 && spread > 0 {
			normalized = clamp(mean + (r.value-st.mean)/st.spread*spread)
		}
		a := byApp[r.app]
		if a == nil {
			a = &acc{}
			byApp[r.app] = a
		}
		a.raw += r.value
		a.normalized += normalized
		a.n++
	}

	out := make([]Score, 0, len(byApp))
	for app, a := range byApp {
		out = append(out, Score{
			ApplicationID: app,
			Raw:           a.raw / float64(a.n),
			Normalized:    a.normalized / float64(a.n),
			Reviews:       a.n,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ApplicationID < out[j].ApplicationID })
	return out
}

func combineReviews(ratings []Rating) []review {
	type key struct{ app, reviewer string }
	type acc struct{ sum, weight float64 }
	sums := map[key]*acc{}
	var order []key
	for _, r := range ratings {
		if r.Weight <= 0 {
			continue
		}
		k := key{r.ApplicationID, r.ReviewerNUID}
		a := sums[k]
		if a == nil {
			a = &acc{}
			sums[k] = a
			order = append(order, k)
		}
		a.sum += clamp(r.Value) * r.Weight
		a.weight += r.Weight
	}
	out := make([]review, 0, len(order))
	for _, k := range order {
		a := sums[k]
		out = append(out, review{app: k.app, reviewer: k.reviewer, value: a.sum / a.weight})
	}
	return out
}

func meanSpread(values []float64) (float64, float64) {
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))
	var sq float64
	for _, v := range values {
		sq += (v - mean) * (v - mean)
	}
	return mean, math.Sqrt(sq / float64(len(values)))
}

func clamp(v float64) float64 {
	return math.Max(0, math.Min(1, v))
}

func Scale(value, lo, hi float64) float64 {
	if hi <= lo {
		return 0
	}
	return (value - lo) / (hi - lo)
}

func Unscale(value, lo, hi float64) float64 {
	return lo + value*(hi-lo)
}

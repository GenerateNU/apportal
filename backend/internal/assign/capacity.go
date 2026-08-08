package assign

import "fmt"

// Capacity sizing. A chief builds teams first and needs to know what per-lead
// cap actually works before generating anything — picking one by eye is how you
// end up with half the pool under-reviewed.

// CapacityInput describes a hypothetical run: a pool of applications, a set of
// teams, and a coverage target.
type CapacityInput struct {
	Applications int
	Teams        []Team
	Coverage     int
}

// Capacity reports what the given team layout can absorb and what cap to set.
type Capacity struct {
	Applications int `json:"applications"`
	Teams        int `json:"teams"`
	Leads        int `json:"leads"`
	Coverage     int `json:"coverage"`

	// RequiredSlots is Applications × Coverage — the total reviews to hand out.
	RequiredSlots int `json:"required_slots"`
	// MaxCoverage is the deepest coverage these teams can reach at any cap.
	// Because a team reviews an application at most once, it equals the team
	// count — more leads on a team never buys more coverage.
	MaxCoverage int `json:"max_coverage"`
	// Feasible is false when no cap can hit Coverage (too few teams).
	Feasible bool `json:"feasible"`

	// MinCap is the smallest per-lead cap that can cover the pool.
	MinCap int `json:"min_cap"`
	// SuggestedCap adds headroom over MinCap so the planner has room to balance.
	SuggestedCap int `json:"suggested_cap"`
	// EvenSplit is the naive Applications × Coverage / Leads. It matches MinCap
	// for evenly sized teams and understates it otherwise.
	EvenSplit int `json:"even_split"`

	// PerLeadAtSuggested is the load each lead should actually expect — the
	// cap is a ceiling, this is the average they'll really carry.
	PerLeadAtSuggested int `json:"per_lead_at_suggested"`

	Notes []string `json:"notes"`
}

// SuggestCapacity computes the minimum and suggested per-lead caps for a team
// layout. It is pure and cheap enough to call on every keystroke as a chief
// builds teams.
func SuggestCapacity(in CapacityInput) (Capacity, error) {
	if in.Coverage <= 0 {
		return Capacity{}, fmt.Errorf("coverage must be positive, got %d", in.Coverage)
	}
	if in.Applications < 0 {
		return Capacity{}, fmt.Errorf("applications must not be negative, got %d", in.Applications)
	}

	sizes := make([]int, 0, len(in.Teams))
	leads := 0
	for _, t := range in.Teams {
		if len(t.LeadNUIDs) == 0 {
			return Capacity{}, fmt.Errorf("team %q has no leads", t.Name)
		}
		sizes = append(sizes, len(t.LeadNUIDs))
		leads += len(t.LeadNUIDs)
	}

	out := Capacity{
		Applications:  in.Applications,
		Teams:         len(in.Teams),
		Leads:         leads,
		Coverage:      in.Coverage,
		RequiredSlots: in.Applications * in.Coverage,
		MaxCoverage:   len(in.Teams),
		Feasible:      len(in.Teams) >= in.Coverage && leads > 0,
	}

	if leads > 0 {
		out.EvenSplit = ceilDiv(out.RequiredSlots, leads)
	}

	if !out.Feasible {
		if leads == 0 {
			out.Notes = append(out.Notes, "add at least one team before sizing the cap")
		} else {
			out.Notes = append(out.Notes, fmt.Sprintf(
				"coverage of %d needs at least %d teams, but only %d %s defined — no cap can fix this, because two leads on the same team never review the same application",
				in.Coverage, in.Coverage, len(in.Teams), plural(len(in.Teams), "is", "are")))
		}
		return out, nil
	}

	out.MinCap = minFeasibleCap(sizes, in.Applications, in.Coverage)
	out.SuggestedCap = max(min(out.MinCap+headroom(out.MinCap), in.Applications), out.MinCap)
	out.PerLeadAtSuggested = out.EvenSplit

	if out.MinCap > out.EvenSplit {
		out.Notes = append(out.Notes, fmt.Sprintf(
			"uneven team sizes push the minimum cap to %d, above the %d an even split would suggest: a team only ever reviews an application once, so a large team cannot absorb a share proportional to its size",
			out.MinCap, out.EvenSplit))
	}
	if out.SuggestedCap > out.MinCap {
		out.Notes = append(out.Notes, fmt.Sprintf(
			"%d is the hard minimum; %d leaves the planner room to balance loads and absorb late applications",
			out.MinCap, out.SuggestedCap))
	}

	return out, nil
}

// minFeasibleCap finds the smallest per-lead cap under which the teams can
// cover every application to the requested depth. Placeable capacity rises
// monotonically with the cap, so a binary search over [0, apps] settles it —
// apps is always sufficient, since at that cap every team can take the whole
// pool and coverage is bounded only by team count.
func minFeasibleCap(sizes []int, apps, coverage int) int {
	need := apps * coverage
	lo, hi := 0, apps
	for lo < hi {
		mid := (lo + hi) / 2
		if placeable(sizes, mid, apps) >= need {
			hi = mid
		} else {
			lo = mid + 1
		}
	}
	return lo
}

// placeable is how many reviews the teams can absorb at a given cap. Each
// team is limited both by its leads' combined cap and by the pool size, since
// it reviews any one application at most once.
func placeable(sizes []int, perLead, apps int) int {
	total := 0
	for _, s := range sizes {
		total += min(perLead*s, apps)
	}
	return total
}

// headroom is the slack added over the minimum cap: 10%, but at least 1. The
// planner is greedy, not optimal, so a cap set exactly at the minimum can leave
// a few applications short even though a perfect assignment exists.
func headroom(minCap int) int {
	return max(1, ceilDiv(minCap, 10))
}

func ceilDiv(a, b int) int {
	if b == 0 {
		return 0
	}
	return (a + b - 1) / b
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

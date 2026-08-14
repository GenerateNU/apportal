package interviewassign

import "fmt"

// Capacity sizing. Unlike backend/internal/assign, there's no team concept
// here, so the minimum cap collapses to the naive even split — a lead's day
// doesn't limit how many applicants they can be assigned (that's a soft
// preference, not a hard partition), so every lead can in principle absorb
// any share of the pool.

// CapacityInput describes a hypothetical run: a pool of applicants and a set
// of leads.
type CapacityInput struct {
	Applicants int
	Leads      int
	// Coverage is reviewers per application (1 for the interviewer stage).
	Coverage int
}

// Capacity reports what the given lead count can absorb and what cap to set.
type InterviewCapacity struct {
	Applicants int `json:"applicants"`
	Leads      int `json:"leads"`
	Coverage   int `json:"coverage"`

	// RequiredSlots is Applicants × Coverage — the total assignments to hand out.
	RequiredSlots int `json:"required_slots"`
	// Feasible is false when there are no leads at all.
	Feasible bool `json:"feasible"`

	// MinCap is the smallest per-lead cap that can cover the pool.
	MinCap int `json:"min_cap"`
	// SuggestedCap adds headroom over MinCap so the planner has room to balance.
	SuggestedCap int `json:"suggested_cap"`

	Notes []string `json:"notes"`
}

// SuggestCapacity computes the minimum and suggested per-lead caps for a lead
// count. It is pure and cheap enough to call on every keystroke as a chief
// fills in meeting days.
func SuggestCapacity(in CapacityInput) (InterviewCapacity, error) {
	if in.Coverage <= 0 {
		return InterviewCapacity{}, fmt.Errorf("coverage must be positive, got %d", in.Coverage)
	}
	if in.Applicants < 0 {
		return InterviewCapacity{}, fmt.Errorf("applicants must not be negative, got %d", in.Applicants)
	}
	if in.Leads < 0 {
		return InterviewCapacity{}, fmt.Errorf("leads must not be negative, got %d", in.Leads)
	}

	out := InterviewCapacity{
		Applicants:    in.Applicants,
		Leads:         in.Leads,
		Coverage:      in.Coverage,
		RequiredSlots: in.Applicants * in.Coverage,
		Feasible:      in.Leads > 0,
	}

	if !out.Feasible {
		out.Notes = append(out.Notes, "add at least one lead before sizing the cap")
		return out, nil
	}

	out.MinCap = ceilDiv(out.RequiredSlots, in.Leads)
	out.SuggestedCap = max(out.MinCap+headroom(out.MinCap), out.MinCap)
	if in.Applicants > 0 && out.SuggestedCap > in.Applicants {
		out.SuggestedCap = in.Applicants
	}

	if out.SuggestedCap > out.MinCap {
		out.Notes = append(out.Notes, fmt.Sprintf(
			"%d is the hard minimum; %d leaves the planner room to balance loads and absorb late applicants",
			out.MinCap, out.SuggestedCap))
	}
	out.Notes = append(out.Notes, "this doesn't account for meeting-day overlap — a day with few available leads and many matching applicants may still fall short even under this cap; the preview will warn if so")

	return out, nil
}

// headroom is the slack added over the minimum cap: 10%, but at least 1. The
// planner is greedy, not optimal, so a cap set exactly at the minimum can
// leave a few applicants short even though a perfect assignment exists.
func headroom(minCap int) int {
	return max(1, ceilDiv(minCap, 10))
}

func ceilDiv(a, b int) int {
	if b == 0 {
		return 0
	}
	return (a + b - 1) / b
}

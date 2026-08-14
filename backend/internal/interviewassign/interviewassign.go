// Package interviewassign plans one interviewer per application, then N
// interview-recording reviewers per application, for the pool of applications
// a chief has moved to the interview stage.
//
// Unlike backend/internal/assign, there is no group-exclusivity constraint
// here — eligibility is per-application (a lead's declared meeting day must be
// one the applicant marked available) and the "avoid this lead" preferences
// are soft tie-breaks, not hard rules. So both stages are a direct greedy
// scoring loop over eligible leads rather than the team-bipartite matching
// assign uses. Planning is pure and deterministic: the same input always
// yields the same plan, and nothing here touches the database.
package interviewassign

import (
	"fmt"
	"math/rand/v2"
	"sort"

	"github.com/GenerateNU/apportal/backend/internal/assign"
)

// SeedFrom derives a stable seed from arbitrary key parts, so repeated
// generates for the same pool shuffle identically. Delegates to assign's
// implementation rather than duplicating it, since it's already exported and
// carries no coupling beyond this one utility.
func SeedFrom(parts ...string) uint64 {
	return assign.SeedFrom(parts...)
}

// Lead is one eligible interviewer/reviewer. Day is the ephemeral meeting-day
// key the chief declared for this run (never persisted, re-supplied every
// planning session — the frontend's four weekly AVAILABILITY_OPTIONS keys).
type Lead struct {
	NUID string
	Day  string
}

// Applicant is one application in the pool, with the meeting-day keys its
// applicant marked available (from their availability JSON blob).
type Applicant struct {
	ApplicationID string
	AvailableDays map[string]bool
}

// LeadLoad reports one lead's workload under a plan.
type LeadLoad struct {
	LeadNUID string `json:"lead_nuid"`
	Day      string `json:"day"`
	Existing int    `json:"existing"`
	Added    int    `json:"added"`
	Total    int    `json:"total"`
	Cap      int    `json:"cap"`
}

// leadState is shared per-lead bookkeeping used by both planners.
type leadState struct {
	nuid string
	day  string
	cap  int
	load int
	adds int
}

func buildLeads(in []Lead, cap int, capOverrides map[string]int) ([]leadState, map[string]int, error) {
	out := make([]leadState, len(in))
	byNUID := make(map[string]int, len(in))
	for i, l := range in {
		if _, dup := byNUID[l.NUID]; dup {
			return nil, nil, fmt.Errorf("lead %s declared twice", l.NUID)
		}
		c := cap
		if override, ok := capOverrides[l.NUID]; ok {
			if override < 0 {
				return nil, nil, fmt.Errorf("cap override for lead %s is negative", l.NUID)
			}
			c = override
		}
		byNUID[l.NUID] = i
		out[i] = leadState{nuid: l.NUID, day: l.Day, cap: c}
	}
	return out, byNUID, nil
}

func loads(leads []leadState) []LeadLoad {
	out := make([]LeadLoad, len(leads))
	for i, l := range leads {
		out[i] = LeadLoad{
			LeadNUID: l.nuid,
			Day:      l.day,
			Existing: l.load - l.adds,
			Added:    l.adds,
			Total:    l.load,
			Cap:      l.cap,
		}
	}
	return out
}

// --- stage 1: interviewers ---

// InterviewerPair is one lead assigned to interview one application.
type InterviewerPair struct {
	ApplicationID string `json:"application_id"`
	LeadNUID      string `json:"lead_nuid"`
}

// InterviewerInput is everything the interviewer planner needs. Existing
// assignments are never modified — they seed each lead's load, and an
// application already in Existing is skipped entirely.
type InterviewerInput struct {
	Applicants []Applicant
	Leads      []Lead
	// Existing maps an application already assigned an interviewer to that
	// interviewer's NUID.
	Existing map[string]string
	// WroteReview maps an application to the set of lead NUIDs who wrote that
	// applicant's lead review — soft-avoided as interviewer (a tie-break, not
	// an exclusion).
	WroteReview map[string]map[string]bool
	// Conflicts maps an application to the set of lead NUIDs declared to have
	// a conflict of interest with that applicant — a hard exclusion, never
	// overridden even if it leaves the applicant unassigned.
	Conflicts    map[string]map[string]bool
	Cap          int
	CapOverrides map[string]int
	Seed         uint64
}

// InterviewerPlan is the result of planning stage 1.
type InterviewerPlan struct {
	New []InterviewerPair `json:"new"`
	// Loads is per-lead workload, ordered by NUID.
	Loads []LeadLoad `json:"loads"`
	// NoDayMatch lists applications assigned despite no candidate sharing a
	// day with the applicant (the best-effort fallback fired), sorted.
	NoDayMatch []string `json:"no_day_match"`
	// Unassigned lists applications no lead had spare capacity for at all,
	// sorted.
	Unassigned []string `json:"unassigned"`
	Warnings   []string `json:"warnings"`
}

// PlanInterviewers assigns one interviewer to every applicant not already
// assigned one. It returns an error only for malformed input; capacity
// shortfalls and day mismatches are reported as warnings instead, because a
// partial assignment is still useful.
func PlanInterviewers(in InterviewerInput) (InterviewerPlan, error) {
	if in.Cap <= 0 {
		return InterviewerPlan{}, fmt.Errorf("cap must be positive, got %d", in.Cap)
	}

	leads, byNUID, err := buildLeads(in.Leads, in.Cap, in.CapOverrides)
	if err != nil {
		return InterviewerPlan{}, err
	}

	var unknownExisting []string
	for _, nuid := range in.Existing {
		if li, ok := byNUID[nuid]; ok {
			leads[li].load++
		} else {
			unknownExisting = append(unknownExisting, nuid)
		}
	}

	appIDs := make([]string, len(in.Applicants))
	byApp := make(map[string]Applicant, len(in.Applicants))
	for i, a := range in.Applicants {
		appIDs[i] = a.ApplicationID
		byApp[a.ApplicationID] = a
	}

	apps := shuffled(appIDs, in.Seed)

	var added []InterviewerPair
	var noDayMatch, unassigned []string

	for _, appID := range apps {
		if _, already := in.Existing[appID]; already {
			continue
		}

		app := byApp[appID]
		wrote := in.WroteReview[appID]
		conflicted := in.Conflicts[appID]

		li, dayMatched := bestInterviewer(leads, app.AvailableDays, wrote, conflicted)
		if li < 0 {
			unassigned = append(unassigned, appID)
			continue
		}
		if !dayMatched {
			noDayMatch = append(noDayMatch, appID)
		}

		leads[li].load++
		leads[li].adds++
		added = append(added, InterviewerPair{ApplicationID: appID, LeadNUID: leads[li].nuid})
	}

	sort.Strings(noDayMatch)
	sort.Strings(unassigned)

	plan := InterviewerPlan{
		New:        added,
		Loads:      loads(leads),
		NoDayMatch: noDayMatch,
		Unassigned: unassigned,
	}
	plan.Warnings = interviewerWarnings(len(in.Applicants), leads, unassigned, noDayMatch, unknownExisting)
	return plan, nil
}

// loadRatio is a lead's load relative to their own cap, so leads with
// different caps (via CapOverrides) are balanced proportionally rather than
// by raw count — the same idea as assign.assignOne's team.load/team.cap.
func loadRatio(l leadState) float64 {
	return float64(l.load) / float64(l.cap)
}

// bestInterviewer picks the lead with the most headroom to interview an
// applicant, preferring a day match and, among day-matched candidates,
// someone who did not already write that applicant's review. A lead in
// conflicted is never chosen, even if that leaves the applicant unassigned.
// Returns -1 if no eligible lead has spare capacity at all. The second
// return reports whether the chosen lead's day actually matched the
// applicant's availability.
func bestInterviewer(leads []leadState, availableDays, wroteReview, conflicted map[string]bool) (int, bool) {
	best, bestDayMatch := -1, false
	var bestRatio float64
	var bestWrote bool

	consider := func(li int, dayMatch bool) {
		l := leads[li]
		ratio := loadRatio(l)
		wrote := wroteReview[l.nuid]
		if best < 0 ||
			ratio < bestRatio ||
			(ratio == bestRatio && !wrote && bestWrote) ||
			(ratio == bestRatio && wrote == bestWrote && l.nuid < leads[best].nuid) {
			best, bestDayMatch, bestRatio, bestWrote = li, dayMatch, ratio, wrote
		}
	}

	for li, l := range leads {
		if l.load >= l.cap || conflicted[l.nuid] || !availableDays[l.day] {
			continue
		}
		consider(li, true)
	}
	if best >= 0 {
		return best, bestDayMatch
	}

	// No day-matched candidate had room: fall back to anyone with capacity
	// (excluding conflicted leads).
	for li, l := range leads {
		if l.load >= l.cap || conflicted[l.nuid] {
			continue
		}
		consider(li, false)
	}
	return best, bestDayMatch
}

func interviewerWarnings(pool int, leads []leadState, unassigned, noDayMatch, unknownExisting []string) []string {
	var out []string

	if len(unassigned) > 0 {
		out = append(out, fmt.Sprintf(
			"%d of %d applicant(s) could not be assigned an interviewer: the leads have no spare capacity left (raise the cap to about %d per lead, or add leads)",
			len(unassigned), pool, perLeadNeeded(pool, 1, len(leads))))
	}

	if len(noDayMatch) > 0 {
		out = append(out, fmt.Sprintf(
			"%d applicant(s) had no interviewer available on a matching day; assigned the best available lead instead",
			len(noDayMatch)))
	}

	if len(unknownExisting) > 0 {
		out = append(out, fmt.Sprintf(
			"%d existing interviewer assignment(s) belong to leads outside the declared roster; they still hold their applicant but weren't counted against any cap",
			len(unknownExisting)))
	}

	return out
}

// --- stage 2: interview reviewers ---

// ReviewerPair is one lead assigned to review one application's interview.
type ReviewerPair struct {
	ApplicationID string `json:"application_id"`
	LeadNUID      string `json:"lead_nuid"`
}

// ReviewerInput is everything the reviewer planner needs.
type ReviewerInput struct {
	Applicants []Applicant
	Leads      []Lead
	// Interviewer maps an application to its assigned interviewer's NUID, so
	// the planner can look up that lead's day for the soft same-day
	// avoidance. An application missing here (or whose interviewer isn't in
	// Leads) simply never triggers that avoidance.
	Interviewer map[string]string
	// Conflicts maps an application to the set of lead NUIDs declared to have
	// a conflict of interest with that applicant — a hard exclusion from
	// reviewing that applicant's interview, same list used for the
	// interviewer stage.
	Conflicts map[string]map[string]bool
	// Existing reviewer pairs already assigned — never modified; a lead
	// already reviewing an application is never assigned to it again.
	Existing     []ReviewerPair
	Cap          int
	CapOverrides map[string]int
	// Coverage is how many distinct leads should review each application.
	Coverage int
	Seed     uint64
}

// ReviewerPlan is the result of planning stage 2.
type ReviewerPlan struct {
	New   []ReviewerPair `json:"new"`
	Loads []LeadLoad     `json:"loads"`
	// CoverageCounts maps a reviewer count to how many applications ended up
	// with exactly that many reviewers.
	CoverageCounts map[int]int `json:"coverage_counts"`
	// UnderCovered lists applications left below Coverage, sorted.
	UnderCovered []string `json:"under_covered"`
	// NoDayMatch lists applications where at least one assigned reviewer had
	// no day overlap with the applicant (the best-effort fallback fired at
	// least once for this app), sorted.
	NoDayMatch []string `json:"no_day_match"`
	Warnings   []string `json:"warnings"`
}

// PlanReviewers assigns Coverage distinct reviewers to every applicant, on
// top of whatever reviewers already exist.
func PlanReviewers(in ReviewerInput) (ReviewerPlan, error) {
	if in.Cap <= 0 {
		return ReviewerPlan{}, fmt.Errorf("cap must be positive, got %d", in.Cap)
	}
	if in.Coverage <= 0 {
		return ReviewerPlan{}, fmt.Errorf("coverage must be positive, got %d", in.Coverage)
	}

	leads, byNUID, err := buildLeads(in.Leads, in.Cap, in.CapOverrides)
	if err != nil {
		return ReviewerPlan{}, err
	}

	onApp := make(map[string]map[string]bool)
	depth := make(map[string]int)
	before := make(map[string]int)
	var unknownExisting []string
	for _, e := range in.Existing {
		depth[e.ApplicationID]++
		if onApp[e.ApplicationID] == nil {
			onApp[e.ApplicationID] = make(map[string]bool)
		}
		onApp[e.ApplicationID][e.LeadNUID] = true
		if li, ok := byNUID[e.LeadNUID]; ok {
			leads[li].load++
		} else {
			unknownExisting = append(unknownExisting, e.LeadNUID)
		}
	}
	for app, d := range depth {
		before[app] = d
	}

	appIDs := make([]string, len(in.Applicants))
	byApp := make(map[string]Applicant, len(in.Applicants))
	for i, a := range in.Applicants {
		appIDs[i] = a.ApplicationID
		byApp[a.ApplicationID] = a
	}
	apps := shuffled(appIDs, in.Seed)

	interviewerDay := make(map[string]string, len(in.Interviewer))
	for appID, nuid := range in.Interviewer {
		if li, ok := byNUID[nuid]; ok {
			interviewerDay[appID] = leads[li].day
		}
		// A lead never reviews the interview they themselves conducted —
		// unlike the same-day-as-interviewer rule below, this is a hard
		// exclusion, not a soft preference. Reuse the onApp "already
		// assigned" set so it falls out of the existing exclusion check.
		if onApp[appID] == nil {
			onApp[appID] = make(map[string]bool)
		}
		onApp[appID][nuid] = true
	}

	// Declared conflicts of interest are a hard exclusion too — merged into
	// the same "already on this app" set, so they fall out of bestReviewer's
	// existing exclusion check without a separate parameter.
	for appID, conflicted := range in.Conflicts {
		if onApp[appID] == nil {
			onApp[appID] = make(map[string]bool)
		}
		for nuid := range conflicted {
			onApp[appID][nuid] = true
		}
	}

	var added []ReviewerPair
	noDayMatchSet := make(map[string]bool)

	for round := 1; round <= in.Coverage; round++ {
		for _, appID := range apps {
			if depth[appID] >= round {
				continue
			}
			app := byApp[appID]
			li, dayMatched := bestReviewer(leads, onApp[appID], app.AvailableDays, interviewerDay[appID])
			if li < 0 {
				continue
			}
			if !dayMatched {
				noDayMatchSet[appID] = true
			}

			leads[li].load++
			leads[li].adds++
			depth[appID]++
			if onApp[appID] == nil {
				onApp[appID] = make(map[string]bool)
			}
			onApp[appID][leads[li].nuid] = true
			added = append(added, ReviewerPair{ApplicationID: appID, LeadNUID: leads[li].nuid})
		}
	}

	coverageCounts := make(map[int]int)
	var underCovered []string
	for _, appID := range appIDs {
		d := depth[appID]
		coverageCounts[d]++
		if d < in.Coverage {
			underCovered = append(underCovered, appID)
		}
	}
	sort.Strings(underCovered)

	noDayMatch := make([]string, 0, len(noDayMatchSet))
	for appID := range noDayMatchSet {
		noDayMatch = append(noDayMatch, appID)
	}
	sort.Strings(noDayMatch)

	plan := ReviewerPlan{
		New:            added,
		Loads:          loads(leads),
		CoverageCounts: coverageCounts,
		UnderCovered:   underCovered,
		NoDayMatch:     noDayMatch,
	}
	plan.Warnings = reviewerWarnings(in, leads, before, underCovered, noDayMatch, unknownExisting)
	return plan, nil
}

// bestReviewer picks the lead with spare capacity to review an application's
// interview, excluding leads already on that application, preferring a day
// match and, among day-matched candidates, someone who does not share the
// assigned interviewer's day. Returns -1 if no lead has spare capacity.
func bestReviewer(leads []leadState, already map[string]bool, availableDays map[string]bool, interviewerDay string) (int, bool) {
	best, bestDayMatch := -1, false
	var bestRatio float64
	var bestSameDay bool

	consider := func(li int, dayMatch bool) {
		l := leads[li]
		ratio := loadRatio(l)
		sameDay := interviewerDay != "" && l.day == interviewerDay
		if best < 0 ||
			ratio < bestRatio ||
			(ratio == bestRatio && !sameDay && bestSameDay) ||
			(ratio == bestRatio && sameDay == bestSameDay && l.nuid < leads[best].nuid) {
			best, bestDayMatch, bestRatio, bestSameDay = li, dayMatch, ratio, sameDay
		}
	}

	for li, l := range leads {
		if l.load >= l.cap || already[l.nuid] || !availableDays[l.day] {
			continue
		}
		consider(li, true)
	}
	if best >= 0 {
		return best, bestDayMatch
	}

	for li, l := range leads {
		if l.load >= l.cap || already[l.nuid] {
			continue
		}
		consider(li, false)
	}
	return best, bestDayMatch
}

func reviewerWarnings(in ReviewerInput, leads []leadState, before map[string]int, underCovered, noDayMatch, unknownExisting []string) []string {
	var out []string

	if len(underCovered) > 0 {
		var totalCap, used int
		for _, l := range leads {
			totalCap += l.cap
			used += l.load - l.adds
		}
		demand := 0
		for _, app := range in.Applicants {
			if need := in.Coverage - before[app.ApplicationID]; need > 0 {
				demand += need
			}
		}
		free := totalCap - used
		if demand > free {
			out = append(out, fmt.Sprintf(
				"capacity is short by %d review slot(s): %d application(s) still need %d slot(s) but the leads have %d left (raise the cap to about %d per lead)",
				demand-free, len(underCovered), demand, free, perLeadNeeded(len(in.Applicants), in.Coverage, len(leads))))
		} else {
			out = append(out, fmt.Sprintf(
				"%d application(s) could not reach %d reviewer(s) — every remaining lead was already assigned to them",
				len(underCovered), in.Coverage))
		}
	}

	if len(noDayMatch) > 0 {
		out = append(out, fmt.Sprintf(
			"%d applicant(s) had no reviewer available on a matching day for at least one slot; assigned the best available lead instead",
			len(noDayMatch)))
	}

	if len(unknownExisting) > 0 {
		out = append(out, fmt.Sprintf(
			"%d existing reviewer assignment(s) belong to leads outside the declared roster; they still count but weren't counted against any cap", len(unknownExisting)))
	}

	return out
}

func perLeadNeeded(applicants, coverage, leads int) int {
	if leads == 0 {
		return 0
	}
	return (applicants*coverage + leads - 1) / leads
}

// shuffled returns a seeded permutation of ids, so re-runs are reproducible
// but assignment doesn't track application-ID order.
func shuffled(ids []string, seed uint64) []string {
	out := append([]string(nil), ids...)
	sort.Strings(out)
	rng := rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))
	rng.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

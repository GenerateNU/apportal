// Package assign plans lead review assignments for a pool of applications.
//
// Leads work in teams (a lead and their co-lead). The defining constraint is
// that no two leads on the same team review the same application — a team
// touches an application at most once. That means an application's N reviewers
// must come from N *distinct* teams, which reduces the whole problem to a
// degree-constrained bipartite assignment: applications need `Coverage` teams
// each, and a team can absorb `Cap` applications per lead it holds.
//
// Planning is pure and deterministic: the same input always yields the same
// plan, and nothing here touches the database. Callers persist Plan.New
// themselves.
package assign

import (
	"fmt"
	"hash/fnv"
	"maps"
	"math/rand/v2"
	"sort"
)

// Team is a group of leads who review together. Teams are supplied per request
// rather than stored, so the same leads can be regrouped between runs.
type Team struct {
	Name      string   `json:"name"`
	LeadNUIDs []string `json:"lead_nuids"`
}

// Pair is one lead assigned to one application.
type Pair struct {
	ApplicationID string `json:"application_id"`
	LeadNUID      string `json:"lead_nuid"`
}

// Input is everything the planner needs. Existing assignments are never
// modified or deleted — they seed each lead's load and each application's
// coverage, and planning only adds what is missing.
type Input struct {
	ApplicationIDs []string
	Teams          []Team
	Existing       []Pair
	// Cap is the default maximum applications per lead. CapOverrides raises or
	// lowers it for individual leads (by NUID).
	Cap          int
	CapOverrides map[string]int
	// Coverage is how many distinct leads should review each application.
	Coverage int
	// Seed makes the shuffle reproducible. Callers should derive it from a
	// stable key (see SeedFrom) so re-running a generate produces the same plan.
	Seed uint64
}

// LeadLoad reports one lead's workload under the plan.
type LeadLoad struct {
	LeadNUID string `json:"lead_nuid"`
	TeamName string `json:"team_name"`
	Existing int    `json:"existing"`
	Added    int    `json:"added"`
	Total    int    `json:"total"`
	Cap      int    `json:"cap"`
}

// Plan is the result of planning: the assignments to create plus enough
// reporting for a chief to sanity-check them before committing.
type Plan struct {
	// New holds the assignments to create, in a stable order.
	New []Pair `json:"new"`
	// Loads is per-lead workload, ordered by team then NUID.
	Loads []LeadLoad `json:"loads"`
	// CoverageCounts maps a reviewer count to how many applications ended up
	// with exactly that many reviewers.
	CoverageCounts map[int]int `json:"coverage_counts"`
	// UnderCovered lists applications left below Coverage, sorted.
	UnderCovered []string `json:"under_covered"`
	// Warnings explains anything the chief should know: infeasible capacity,
	// leads assigned outside the declared teams, and so on.
	Warnings []string `json:"warnings"`
}

// SeedFrom derives a stable seed from arbitrary key parts (typically cycle ID
// and role), so repeated generates for the same pool shuffle identically.
func SeedFrom(parts ...string) uint64 {
	h := fnv.New64a()
	for _, p := range parts {
		_, _ = h.Write([]byte(p))
		_, _ = h.Write([]byte{0})
	}
	return h.Sum64()
}

// internal per-lead state
type lead struct {
	nuid string
	team int
	cap  int
	load int // existing + added so far
	adds int
}

// internal per-team state
type team struct {
	name  string
	leads []int // indices into planner.leads
	load  int   // sum of member loads
	cap   int   // sum of member caps
}

type planner struct {
	leads   []lead
	teams   []team
	byNUID  map[string]int
	teamsOn map[string]map[int]bool // application -> team indices already on it
	depth   map[string]int          // application -> distinct reviewers so far
	before  map[string]int          // application -> reviewers before planning
	pairs   [][]int                 // co-review counts between team indices
	added   []Pair
}

// Compute plans the assignments to add. It returns an error only for malformed
// input (a lead on two teams, a non-positive cap); capacity shortfalls are
// reported as warnings and under-covered applications instead, because a
// partial assignment is still useful.
func Compute(in Input) (Plan, error) {
	p, err := newPlanner(in)
	if err != nil {
		return Plan{}, err
	}

	apps := shuffled(in.ApplicationIDs, in.Seed)

	// Fill by coverage round, not by application: every application gets its
	// first reviewer before any gets its second. If capacity runs out mid-run
	// the shortfall is spread evenly instead of leaving some applications with
	// a full slate and others with none.
	for round := 1; round <= in.Coverage; round++ {
		for _, app := range apps {
			if p.depth[app] >= round {
				continue
			}
			p.assignOne(app)
		}
	}

	return p.result(in), nil
}

func newPlanner(in Input) (*planner, error) {
	if in.Cap <= 0 {
		return nil, fmt.Errorf("cap must be positive, got %d", in.Cap)
	}
	if in.Coverage <= 0 {
		return nil, fmt.Errorf("coverage must be positive, got %d", in.Coverage)
	}

	p := &planner{
		byNUID:  make(map[string]int),
		teamsOn: make(map[string]map[int]bool),
		depth:   make(map[string]int),
	}

	for ti, t := range in.Teams {
		if len(t.LeadNUIDs) == 0 {
			return nil, fmt.Errorf("team %q has no leads", t.Name)
		}
		cur := team{name: t.Name}
		for _, nuid := range t.LeadNUIDs {
			if prev, dup := p.byNUID[nuid]; dup {
				return nil, fmt.Errorf("lead %s is on two teams (%q and %q)",
					nuid, p.teams[p.leads[prev].team].name, t.Name)
			}
			capacity := in.Cap
			if override, ok := in.CapOverrides[nuid]; ok {
				if override < 0 {
					return nil, fmt.Errorf("cap override for lead %s is negative", nuid)
				}
				capacity = override
			}
			p.byNUID[nuid] = len(p.leads)
			cur.leads = append(cur.leads, len(p.leads))
			cur.cap += capacity
			p.leads = append(p.leads, lead{nuid: nuid, team: ti, cap: capacity})
		}
		p.teams = append(p.teams, cur)
	}

	p.pairs = make([][]int, len(p.teams))
	for i := range p.pairs {
		p.pairs[i] = make([]int, len(p.teams))
	}

	// Seed state from what already exists. An existing assignment always counts
	// toward its application's coverage; it only constrains a team (and consumes
	// a lead's cap) when that lead is on one of the teams declared for this run.
	for _, e := range in.Existing {
		p.depth[e.ApplicationID]++
		li, ok := p.byNUID[e.LeadNUID]
		if !ok {
			continue
		}
		l := &p.leads[li]
		l.load++
		p.teams[l.team].load++
		p.markTeamOn(e.ApplicationID, l.team)
	}

	// Snapshot pre-planning coverage; the capacity warning measures against it.
	p.before = make(map[string]int, len(p.depth))
	maps.Copy(p.before, p.depth)

	return p, nil
}

func (p *planner) markTeamOn(app string, ti int) {
	on := p.teamsOn[app]
	if on == nil {
		on = make(map[int]bool)
		p.teamsOn[app] = on
	}
	for other := range on {
		p.pairs[ti][other]++
		p.pairs[other][ti]++
	}
	on[ti] = true
}

// assignOne gives app one more reviewer, or does nothing if no eligible team
// remains. The chosen team is the one with the most headroom relative to its
// size, so teams of one, two, or three leads all pull their own weight; ties go
// to whichever team has co-reviewed least with the teams already on this
// application, which spreads second opinions around instead of locking pairs of
// teams together.
func (p *planner) assignOne(app string) {
	on := p.teamsOn[app]

	best, bestLead := -1, -1
	var bestLoad float64
	var bestPairs int

	for ti := range p.teams {
		if on[ti] {
			continue
		}
		li := p.leastLoadedLead(ti)
		if li < 0 {
			continue // every lead on this team is at cap
		}

		load := float64(p.teams[ti].load) / float64(p.teams[ti].cap)
		pairs := 0
		for other := range on {
			pairs += p.pairs[ti][other]
		}

		if best < 0 || load < bestLoad ||
			(load == bestLoad && pairs < bestPairs) ||
			(load == bestLoad && pairs == bestPairs && p.leads[li].load < p.leads[bestLead].load) {
			best, bestLead, bestLoad, bestPairs = ti, li, load, pairs
		}
	}

	if best < 0 {
		return
	}

	l := &p.leads[bestLead]
	l.load++
	l.adds++
	p.teams[best].load++
	p.depth[app]++
	p.markTeamOn(app, best)
	p.added = append(p.added, Pair{ApplicationID: app, LeadNUID: l.nuid})
}

// leastLoadedLead returns the index of the team member with the most remaining
// headroom, or -1 when every member is at cap. Ties break on NUID so the plan
// stays deterministic.
func (p *planner) leastLoadedLead(ti int) int {
	best := -1
	for _, li := range p.teams[ti].leads {
		l := p.leads[li]
		if l.load >= l.cap {
			continue
		}
		if best < 0 || l.load < p.leads[best].load ||
			(l.load == p.leads[best].load && l.nuid < p.leads[best].nuid) {
			best = li
		}
	}
	return best
}

func (p *planner) result(in Input) Plan {
	plan := Plan{
		New:            p.added,
		CoverageCounts: make(map[int]int),
	}

	loads := make([]LeadLoad, 0, len(p.leads))
	for _, l := range p.leads {
		loads = append(loads, LeadLoad{
			LeadNUID: l.nuid,
			TeamName: p.teams[l.team].name,
			Existing: l.load - l.adds,
			Added:    l.adds,
			Total:    l.load,
			Cap:      l.cap,
		})
	}
	plan.Loads = loads

	for _, app := range in.ApplicationIDs {
		d := p.depth[app]
		plan.CoverageCounts[d]++
		if d < in.Coverage {
			plan.UnderCovered = append(plan.UnderCovered, app)
		}
	}
	sort.Strings(plan.UnderCovered)

	plan.Warnings = p.warnings(in)
	return plan
}

func (p *planner) warnings(in Input) []string {
	var out []string

	if n := len(in.Teams); n < in.Coverage {
		out = append(out, fmt.Sprintf(
			"coverage of %d is impossible with %d team(s): no two leads on a team share an application, so each application can reach at most %d reviewers",
			in.Coverage, n, n))
	}

	// Capacity headroom, counting only what this run can still place.
	var totalCap, used int
	for _, l := range p.leads {
		totalCap += l.cap
		used += l.load - l.adds
	}
	demand := 0
	for _, app := range in.ApplicationIDs {
		if need := in.Coverage - p.before[app]; need > 0 {
			demand += need
		}
	}
	if free := totalCap - used; demand > free {
		out = append(out, fmt.Sprintf(
			"capacity is short by %d review slot(s): %d application(s) still need %d slot(s) but the leads have %d left (raise the cap to about %d per lead)",
			demand-free, len(in.ApplicationIDs), demand, free, perLeadNeeded(in, len(p.leads))))
	}

	if n := len(p.unknownLeads(in)); n > 0 {
		out = append(out, fmt.Sprintf(
			"%d existing assignment(s) belong to leads outside the declared teams; they still count toward coverage but were left untouched", n))
	}

	return out
}

func (p *planner) unknownLeads(in Input) []string {
	var out []string
	for _, e := range in.Existing {
		if _, ok := p.byNUID[e.LeadNUID]; !ok {
			out = append(out, e.LeadNUID)
		}
	}
	return out
}

func perLeadNeeded(in Input, leads int) int {
	if leads == 0 {
		return 0
	}
	return (len(in.ApplicationIDs)*in.Coverage + leads - 1) / leads
}

// shuffled returns a seeded permutation of ids. Shuffling keeps assignment from
// tracking application-ID order, and the seed keeps re-runs reproducible.
func shuffled(ids []string, seed uint64) []string {
	out := append([]string(nil), ids...)
	sort.Strings(out)
	rng := rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))
	rng.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

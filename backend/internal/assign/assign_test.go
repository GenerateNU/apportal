package assign

import (
	"fmt"
	"testing"
)

// teams builds n teams of the given size with generated NUIDs, e.g. "t0l1".
func teams(n, size int) []Team {
	out := make([]Team, n)
	for i := range out {
		leads := make([]string, size)
		for j := range leads {
			leads[j] = fmt.Sprintf("t%dl%d", i, j)
		}
		out[i] = Team{Name: fmt.Sprintf("team%d", i), LeadNUIDs: leads}
	}
	return out
}

func apps(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("app%03d", i)
	}
	return out
}

// check re-derives the invariants from a plan's output rather than trusting the
// planner's own bookkeeping.
type audit struct {
	perLead    map[string]int
	perApp     map[string]int
	appTeams   map[string]map[string]int // app -> team -> times that team appears
	duplicates int
}

func auditPlan(t *testing.T, in Input, p Plan) audit {
	t.Helper()
	teamOf := map[string]string{}
	for _, tm := range in.Teams {
		for _, l := range tm.LeadNUIDs {
			teamOf[l] = tm.Name
		}
	}

	a := audit{
		perLead:  map[string]int{},
		perApp:   map[string]int{},
		appTeams: map[string]map[string]int{},
	}
	seen := map[Pair]bool{}
	for _, pr := range append(append([]Pair{}, in.Existing...), p.New...) {
		if seen[pr] {
			a.duplicates++
		}
		seen[pr] = true
		a.perLead[pr.LeadNUID]++
		a.perApp[pr.ApplicationID]++
		if tm, ok := teamOf[pr.LeadNUID]; ok {
			if a.appTeams[pr.ApplicationID] == nil {
				a.appTeams[pr.ApplicationID] = map[string]int{}
			}
			a.appTeams[pr.ApplicationID][tm]++
		}
	}
	return a
}

// assertInvariants checks the three hard rules: no lead over cap, no team twice
// on one application, no duplicate assignment.
func assertInvariants(t *testing.T, in Input, p Plan) audit {
	t.Helper()
	a := auditPlan(t, in, p)

	if a.duplicates > 0 {
		t.Errorf("plan contains %d duplicate assignment(s)", a.duplicates)
	}
	for nuid, n := range a.perLead {
		limit := in.Cap
		if o, ok := in.CapOverrides[nuid]; ok {
			limit = o
		}
		if n > limit {
			t.Errorf("lead %s has %d assignments, over cap %d", nuid, n, limit)
		}
	}
	for app, byTeam := range a.appTeams {
		for tm, n := range byTeam {
			if n > 1 {
				t.Errorf("application %s has %d leads from team %s; teammates must not share an application", app, n, tm)
			}
		}
	}
	return a
}

// The scenario this was designed around: 80 applications, four teams of two,
// every application read by two leads. Capacity is exactly tight at a cap of 20.
func TestFullCoverageAtExactCapacity(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(80),
		Teams:          teams(4, 2),
		Cap:            20,
		Coverage:       2,
		Seed:           SeedFrom("cycle", "software_engineer"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	if got := len(plan.New); got != 160 {
		t.Errorf("assigned %d reviews, want 160", got)
	}
	if len(plan.UnderCovered) != 0 {
		t.Errorf("%d application(s) under-covered, want full coverage: %v",
			len(plan.UnderCovered), plan.UnderCovered)
	}
	for app, n := range a.perApp {
		if n != 2 {
			t.Errorf("application %s has %d reviewers, want 2", app, n)
		}
	}
	// Exactly tight, so every lead must land on precisely their cap.
	for nuid, n := range a.perLead {
		if n != 20 {
			t.Errorf("lead %s has %d assignments, want 20", nuid, n)
		}
	}
}

// Uneven team sizes must not make the planner lopsided: load is balanced
// relative to each team's capacity, not by raw count.
func TestUnevenTeamSizesBalanceByCapacity(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(60),
		Teams: []Team{
			{Name: "solo", LeadNUIDs: []string{"a"}},
			{Name: "pair", LeadNUIDs: []string{"b", "c"}},
			{Name: "trio", LeadNUIDs: []string{"d", "e", "f"}},
		},
		Cap:      30,
		Coverage: 2,
		Seed:     SeedFrom("uneven"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	if len(plan.UnderCovered) != 0 {
		t.Errorf("%d application(s) under-covered", len(plan.UnderCovered))
	}
	// Per-lead loads should stay close even though team sizes differ 1:2:3.
	// The mean here is 20 (120 slots over 6 leads); greedy tie-breaking plus
	// the one-team-per-application rule costs a little rounding, so allow a
	// spread of 2 rather than demanding a perfect split.
	lo, hi := 1<<30, 0
	for _, n := range a.perLead {
		lo, hi = min(lo, n), max(hi, n)
	}
	if hi-lo > 2 {
		t.Errorf("per-lead loads range %d..%d, want a spread of at most 2: %v", lo, hi, a.perLead)
	}
}

// Re-running with the same teams must add nothing: the plan is additive and
// existing assignments already satisfy coverage.
func TestRerunIsIdempotent(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(40),
		Teams:          teams(3, 2),
		Cap:            20,
		Coverage:       2,
		Seed:           SeedFrom("idem"),
	}

	first, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}

	in.Existing = first.New
	second, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute (rerun): %v", err)
	}
	if len(second.New) != 0 {
		t.Errorf("rerun added %d assignment(s), want 0", len(second.New))
	}
}

// Applications that arrive after a first run get assigned without disturbing
// what already exists.
func TestIncrementalRunOnlyAssignsNewApplications(t *testing.T) {
	base := Input{
		ApplicationIDs: apps(40),
		Teams:          teams(3, 2),
		Cap:            20,
		Coverage:       2,
		Seed:           SeedFrom("incr"),
	}
	first, err := Compute(base)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}

	next := base
	next.ApplicationIDs = apps(50) // ten late arrivals
	next.Existing = first.New

	second, err := Compute(next)
	if err != nil {
		t.Fatalf("Compute (incremental): %v", err)
	}
	assertInvariants(t, next, second)

	if got := len(second.New); got != 20 {
		t.Errorf("added %d assignment(s), want 20 (10 new applications × coverage 2)", got)
	}
	for _, p := range second.New {
		if p.ApplicationID < "app040" {
			t.Errorf("incremental run touched pre-existing application %s", p.ApplicationID)
		}
	}
}

// When capacity runs out, the shortfall must be spread evenly: no application
// should sit at full coverage while another has none.
func TestShortCapacityDegradesEvenly(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(80),
		Teams:          teams(4, 2),
		Cap:            10, // half of what coverage 2 needs
		Coverage:       2,
		Seed:           SeedFrom("short"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	for app, n := range a.perApp {
		if n != 1 {
			t.Errorf("application %s has %d reviewers, want every application at exactly 1 when capacity halves", app, n)
		}
	}
	if len(plan.Warnings) == 0 {
		t.Error("expected a capacity warning")
	}
}

// Coverage can never exceed the team count, however many leads there are.
func TestCoverageBoundedByTeamCount(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(20),
		Teams:          teams(2, 5), // ten leads, but only two teams
		Cap:            20,
		Coverage:       3,
		Seed:           SeedFrom("bounded"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	for app, n := range a.perApp {
		if n != 2 {
			t.Errorf("application %s has %d reviewers, want 2 (capped by team count)", app, n)
		}
	}
	if len(plan.UnderCovered) != 20 {
		t.Errorf("UnderCovered has %d entries, want all 20", len(plan.UnderCovered))
	}
}

// Existing assignments from leads outside the declared teams still count toward
// coverage, but must not be deleted or blamed on a team.
func TestExistingAssignmentFromUnknownLeadCountsTowardCoverage(t *testing.T) {
	in := Input{
		ApplicationIDs: []string{"app000"},
		Teams:          teams(3, 1),
		Existing:       []Pair{{ApplicationID: "app000", LeadNUID: "stranger"}},
		Cap:            5,
		Coverage:       2,
		Seed:           SeedFrom("stranger"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	if got := len(plan.New); got != 1 {
		t.Fatalf("added %d assignment(s), want 1 to top up coverage", got)
	}
	if len(plan.UnderCovered) != 0 {
		t.Errorf("application still under-covered: %v", plan.UnderCovered)
	}
	if len(plan.Warnings) == 0 {
		t.Error("expected a warning about the lead outside the declared teams")
	}
}

func TestCapOverrideRespected(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(30),
		Teams:          teams(3, 2),
		Cap:            20,
		CapOverrides:   map[string]int{"t0l0": 0}, // on leave
		Coverage:       2,
		Seed:           SeedFrom("override"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	if n := a.perLead["t0l0"]; n != 0 {
		t.Errorf("lead t0l0 got %d assignments despite a cap of 0", n)
	}
	if len(plan.UnderCovered) != 0 {
		t.Errorf("%d application(s) under-covered", len(plan.UnderCovered))
	}
}

// The same input must always produce the same plan, so a chief can preview,
// re-run, and commit without the assignments shifting underneath them.
func TestPlanIsDeterministic(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(50),
		Teams:          teams(4, 2),
		Cap:            15,
		Coverage:       2,
		Seed:           SeedFrom("cycle-42", "software_designer"),
	}

	first, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	second, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}

	if len(first.New) != len(second.New) {
		t.Fatalf("plans differ in size: %d vs %d", len(first.New), len(second.New))
	}
	for i := range first.New {
		if first.New[i] != second.New[i] {
			t.Fatalf("plans diverge at %d: %+v vs %+v", i, first.New[i], second.New[i])
		}
	}
}

// Co-review pairings should spread across team combinations rather than locking
// the same two teams together on every application.
func TestCoReviewPairingsAreSpread(t *testing.T) {
	in := Input{
		ApplicationIDs: apps(60),
		Teams:          teams(4, 2),
		Cap:            20,
		Coverage:       2,
		Seed:           SeedFrom("pairs"),
	}

	plan, err := Compute(in)
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	a := assertInvariants(t, in, plan)

	// With four teams there are six possible pairs; each should appear.
	pairCount := map[string]int{}
	for _, byTeam := range a.appTeams {
		names := make([]string, 0, len(byTeam))
		for tm := range byTeam {
			names = append(names, tm)
		}
		if len(names) != 2 {
			continue
		}
		if names[0] > names[1] {
			names[0], names[1] = names[1], names[0]
		}
		pairCount[names[0]+"+"+names[1]]++
	}
	if len(pairCount) != 6 {
		t.Errorf("only %d of 6 team pairings used: %v", len(pairCount), pairCount)
	}
}

func TestRejectsLeadOnTwoTeams(t *testing.T) {
	_, err := Compute(Input{
		ApplicationIDs: apps(5),
		Teams: []Team{
			{Name: "a", LeadNUIDs: []string{"x", "y"}},
			{Name: "b", LeadNUIDs: []string{"y", "z"}},
		},
		Cap:      5,
		Coverage: 1,
	})
	if err == nil {
		t.Fatal("expected an error for a lead on two teams")
	}
}

func TestRejectsNonPositiveCapAndCoverage(t *testing.T) {
	base := Input{ApplicationIDs: apps(5), Teams: teams(2, 1), Cap: 5, Coverage: 1}

	bad := base
	bad.Cap = 0
	if _, err := Compute(bad); err == nil {
		t.Error("expected an error for a cap of 0")
	}

	bad = base
	bad.Coverage = 0
	if _, err := Compute(bad); err == nil {
		t.Error("expected an error for coverage of 0")
	}
}

func TestEmptyApplicationPoolPlansNothing(t *testing.T) {
	plan, err := Compute(Input{Teams: teams(2, 2), Cap: 10, Coverage: 2})
	if err != nil {
		t.Fatalf("Compute: %v", err)
	}
	if len(plan.New) != 0 {
		t.Errorf("planned %d assignment(s) for an empty pool", len(plan.New))
	}
}

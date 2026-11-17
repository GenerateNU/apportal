package reviewboard

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

const (
	roleA = accesstest.RoleID
	roleB = "66666666-6666-4666-8666-666666666666"
)

func chief() context.Context {
	return testutil.WithActor(middleware.Actor{NUID: accesstest.ChiefNUID})
}

func statusOf(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var se huma.StatusError
	if errors.As(err, &se) {
		return se.GetStatus()
	}
	return -1
}

func standardStore() *fakeStore {
	return &fakeStore{
		roles: []string{roleA, roleB},
		staff: staffOf("l1", "l2", accesstest.LeadNUID),
		apps:  []models.ApplicationSummary{app("a1", "u1", roleA, models.StageSubmitted)},
	}
}

func TestReviewRoutesPermissions(t *testing.T) {
	routes := []struct {
		name string
		call func(*reviewService, context.Context, string) error
	}{
		{"review board", func(s *reviewService, ctx context.Context, id string) error {
			_, err := s.reviewBoard(ctx, &ReviewBoardInput{ID: id})
			return err
		}},
		{"auto assign", func(s *reviewService, ctx context.Context, id string) error {
			_, err := s.autoAssign(middleware.WithIntent(ctx, middleware.Intent{DryRun: true}), &AutoAssignInput{ID: id})
			return err
		}},
	}
	want := map[string]int{
		"admin":           http.StatusOK,
		"chief on cycle":  http.StatusOK,
		"chief elsewhere": http.StatusNotFound,
		"lead on cycle":   http.StatusForbidden,
		"applicant":       http.StatusNotFound,
		"unauthenticated": http.StatusUnauthorized,
	}
	for _, r := range routes {
		for _, p := range accesstest.Personas() {
			t.Run(r.name+"/"+p.Name, func(t *testing.T) {
				s := newReviewService(standardStore(), fakeRules{perApplicant: 2, eligible: map[string][]string{roleA: {"l1", "l2"}}})
				if got := statusOf(r.call(s, p.Ctx, accesstest.CycleID)); got != want[p.Name] {
					t.Errorf("got %d, want %d", got, want[p.Name])
				}
			})
		}
		t.Run(r.name+"/malformed cycle id", func(t *testing.T) {
			s := newReviewService(standardStore(), fakeRules{})
			testutil.WantStatus(t, r.call(s, chief(), "not-a-uuid"), http.StatusUnprocessableEntity)
		})
	}
}

func TestReviewBoardGroupsReviewersByApplicant(t *testing.T) {
	store := standardStore()
	store.apps = append(store.apps,
		app("a2", "u2", roleB, models.StageChiefReview),
		app("a3", "u3", roleA, models.StageInterview),
	)
	store.reviewers = []assignedReviewer{
		{ID: "r1", ApplicationID: "a2", LeadNUID: "l1", Started: true, Submitted: true},
		{ID: "r2", ApplicationID: "a2", LeadNUID: "l2", Started: true},
		{ID: "r3", ApplicationID: "a3", LeadNUID: "l1"},
	}
	out, err := newReviewService(store, fakeRules{}).reviewBoard(chief(), &ReviewBoardInput{ID: accesstest.CycleID})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Body) != 2 {
		t.Fatalf("only review stages belong on the board: %+v", out.Body)
	}
	if out.Body[0].Reviewers == nil || len(out.Body[0].Reviewers) != 0 {
		t.Errorf("no reviewers should be an empty list: %+v", out.Body[0])
	}
	r := out.Body[1].Reviewers
	if len(r) != 2 || !r[0].Submitted || r[1].Submitted || !r[1].Started || r[0].AssignmentID != "r1" {
		t.Errorf("reviewers: %+v", r)
	}
}

func autoIn(roles ...string) *AutoAssignInput {
	in := &AutoAssignInput{ID: accesstest.CycleID}
	in.Body.RoleIDs = roles
	return in
}

func dryRun(ctx context.Context) context.Context {
	return middleware.WithIntent(ctx, middleware.Intent{DryRun: true})
}

func TestAutoAssignRejectsBadOpenings(t *testing.T) {
	many := make([]string, maxAutoAssignRoles+1)
	for i := range many {
		many[i] = roleA
	}
	cases := []struct {
		name  string
		roles []string
	}{
		{"malformed", []string{"nope"}},
		{"another cycle's opening", []string{"77777777-7777-4777-8777-777777777777"}},
		{"too many", many},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := standardStore()
			_, err := newReviewService(store, fakeRules{}).autoAssign(chief(), autoIn(tc.roles...))
			testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
			if len(store.saved) != 0 {
				t.Errorf("saved %v", store.saved)
			}
		})
	}
}

func TestAutoAssignDryRunSavesNothing(t *testing.T) {
	store := standardStore()
	rules := fakeRules{perApplicant: 2, eligible: map[string][]string{roleA: {"l1", "l2"}}}
	out, err := newReviewService(store, rules).autoAssign(dryRun(chief()), autoIn())
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Body.New) != 2 || len(store.saved) != 0 || store.locked != 0 {
		t.Errorf("new %v saved %v locked %d", out.Body.New, store.saved, store.locked)
	}
}

func TestAutoAssignSavesUnderTheLock(t *testing.T) {
	store := standardStore()
	store.reviewers = []assignedReviewer{{ApplicationID: "a1", LeadNUID: "l1"}}
	rules := fakeRules{perApplicant: 2, eligible: map[string][]string{roleA: {"l1", "l2"}, roleB: {"l1"}}}
	out, err := newReviewService(store, rules).autoAssign(chief(), autoIn())
	if err != nil {
		t.Fatal(err)
	}
	if store.locked != 1 || !slices.Equal(store.saved, []assign.Pair{{ApplicationID: "a1", LeadNUID: "l2"}}) {
		t.Errorf("saved %v locked %d", store.saved, store.locked)
	}
	if len(out.Body.Positions) != 2 {
		t.Errorf("empty role_ids means every opening: %+v", out.Body.Positions)
	}
	if !slices.Equal(out.Body.Leads, []LeadLoad{
		{LeadNUID: "l1", FullName: "Name l1", Existing: 1},
		{LeadNUID: "l2", FullName: "Name l2", Added: 1},
	}) {
		t.Errorf("leads: %+v", out.Body.Leads)
	}
}

func TestAutoAssignNeedsReviewersEach(t *testing.T) {
	store := standardStore()
	rules := fakeRules{eligible: map[string][]string{roleA: {"l1", "l2"}}}
	_, err := newReviewService(store, rules).autoAssign(chief(), autoIn())
	testutil.WantStatus(t, err, http.StatusConflict)
	if len(store.saved) != 0 {
		t.Errorf("saved %v", store.saved)
	}
}

func TestAutoAssignLeavesFrozenOpeningsAlone(t *testing.T) {
	store := standardStore()
	store.apps = append(store.apps, app("b1", "u2", roleB, models.StageSubmitted))
	rules := fakeRules{perApplicant: 1, eligible: map[string][]string{roleA: {"l1"}, roleB: {"l2"}}, frozen: map[string]bool{roleA: true}}
	s := newReviewService(store, rules)

	_, err := s.autoAssign(chief(), autoIn(roleA))
	testutil.WantStatus(t, err, http.StatusConflict)

	out, err := s.autoAssign(chief(), autoIn())
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(store.saved, []assign.Pair{{ApplicationID: "b1", LeadNUID: "l2"}}) {
		t.Errorf("saved %v", store.saved)
	}
	for _, p := range out.Body.Positions {
		if p.RoleID == roleA && (p.Added != 0 || len(p.Warnings) == 0) {
			t.Errorf("frozen opening: %+v", p)
		}
	}
}

func TestAutoAssignSkipsConflicts(t *testing.T) {
	store := standardStore()
	store.conflicts = []staffing.Conflict{{LeadNUID: "l1", ApplicantNUID: "u1"}}
	rules := fakeRules{perApplicant: 2, eligible: map[string][]string{roleA: {"l1", "l2", "l3"}}}
	out, err := newReviewService(store, rules).autoAssign(dryRun(chief()), autoIn(roleA))
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range out.Body.New {
		if p.LeadNUID == "l1" {
			t.Errorf("l1 has a conflict with u1: %v", out.Body.New)
		}
	}
	if len(out.Body.New) != 2 || out.Body.Positions[0].Short != 0 {
		t.Errorf("l2 and l3 should cover it: %+v", out.Body)
	}
}

func TestAutoAssignReportsWhoCantBeCovered(t *testing.T) {
	store := standardStore()
	store.conflicts = []staffing.Conflict{{LeadNUID: "l1", ApplicantNUID: "u1"}}
	rules := fakeRules{perApplicant: 2, eligible: map[string][]string{roleA: {"l1", "l2"}}}
	out, err := newReviewService(store, rules).autoAssign(dryRun(chief()), autoIn(roleA))
	if err != nil {
		t.Fatal(err)
	}
	pos := out.Body.Positions[0]
	if pos.Added != 1 || pos.Short != 1 || len(pos.Warnings) == 0 {
		t.Errorf("one reviewer is conflicted, so the applicant stays short: %+v", pos)
	}
}

func TestEachReviewerIsTheirOwnTeam(t *testing.T) {
	teams := soloTeams([]string{"a", "b"})
	if len(teams) != 2 || !slices.Equal(teams[1].LeadNUIDs, []string{"b"}) {
		t.Errorf("teams: %+v", teams)
	}
}

func TestCoverageFitsTheReviewers(t *testing.T) {
	if got, w := clampCoverage(3, 5); got != 3 || len(w) != 0 {
		t.Errorf("enough reviewers: %d %v", got, w)
	}
	if got, w := clampCoverage(3, 2); got != 2 || len(w) != 1 {
		t.Errorf("fewer reviewers than wanted: %d %v", got, w)
	}
	if _, w := clampCoverage(2, 0); len(w) != 1 {
		t.Errorf("nobody to review should warn: %v", w)
	}
}

func TestFairFillTopsUpTheLeastLoaded(t *testing.T) {
	got := fairFill([]string{"a", "b", "c"}, map[string]int{"a": 4, "b": 1}, map[string]int{}, 5)
	if got["a"] != 0 || got["b"] != 2 || got["c"] != 3 {
		t.Errorf("b and c should rise to a's 4 before anyone passes it: %v", got)
	}
	more := fairFill([]string{"a", "b", "c"}, map[string]int{"a": 4, "b": 1}, got, 3)
	if more["a"] != 1 || more["b"] != 3 || more["c"] != 4 {
		t.Errorf("past the even level everyone takes one more: %v", more)
	}
}

func roleOpening(roleID string, reviewers []string, coverage int, apps ...string) opening {
	return opening{roleID: roleID, reviewers: reviewers, appIDs: apps, coverage: coverage, blocked: staffing.Blocked{}}
}

func loadsOf(plan AutoAssignPlan) map[string]int {
	out := map[string]int{}
	for _, l := range plan.Leads {
		out[l.LeadNUID] = l.Existing + l.Added
	}
	return out
}

func TestLeadsStayBalancedAcrossOpenings(t *testing.T) {
	small := roleOpening(roleA, []string{"a", "b"}, 1, "d1", "d2", "d3", "d4")
	big := roleOpening(roleB, []string{"a", "b", "c", "d"}, 1, "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8")
	plan, _, err := planOpenings("c1", []opening{big, small}, []string{roleA, roleB})
	if err != nil {
		t.Fatal(err)
	}
	for n, l := range loadsOf(plan) {
		if l != 3 {
			t.Errorf("12 reviews over 4 leads should be 3 each, %s has %d", n, l)
		}
	}
	if plan.Positions[0].RoleID != roleA {
		t.Errorf("positions come back in the requested order: %+v", plan.Positions)
	}
}

func TestOtherOpeningsLoadCountsButIsntPlanned(t *testing.T) {
	other := roleOpening(roleA, []string{"a", "b"}, 1, "d1", "d2", "d3", "d4")
	other.prior = []assign.Pair{{ApplicationID: "d1", LeadNUID: "a"}, {ApplicationID: "d2", LeadNUID: "a"}, {ApplicationID: "d3", LeadNUID: "a"}}
	asked := roleOpening(roleB, []string{"a", "b"}, 1, "e1", "e2", "e3")
	plan, pairs, err := planOpenings("c1", []opening{other, asked}, []string{roleB})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Positions) != 1 || plan.Positions[0].RoleID != roleB {
		t.Fatalf("only the requested opening is planned: %+v", plan.Positions)
	}
	for _, p := range pairs {
		if !slices.Contains(asked.appIDs, p.ApplicationID) {
			t.Errorf("planned outside the requested opening: %v", p)
		}
	}
	if l := loadsOf(plan); l["b"] != 3 || l["a"] != 3 {
		t.Errorf("a already carries 3 elsewhere, so b takes this opening: %v", l)
	}
}

func TestAutoAssignNeverExceedsPerApplicant(t *testing.T) {
	o := roleOpening(roleA, []string{"a", "b", "c"}, 2, "x", "y")
	o.prior = []assign.Pair{{ApplicationID: "x", LeadNUID: "a"}, {ApplicationID: "x", LeadNUID: "b"}, {ApplicationID: "x", LeadNUID: "c"}}
	_, pairs, err := planOpenings("c1", []opening{o}, []string{roleA})
	if err != nil {
		t.Fatal(err)
	}
	if len(pairs) != 2 {
		t.Fatalf("x is already over, y needs two: %v", pairs)
	}
	for _, p := range pairs {
		if p.ApplicationID != "y" {
			t.Errorf("x already has enough reviewers: %v", pairs)
		}
	}
}

func TestCoverageBeatsFairShareWhenShort(t *testing.T) {
	busy := roleOpening(roleA, []string{"a", "b", "c", "d"}, 1, "d1", "d2", "d3", "d4")
	busy.prior = []assign.Pair{{ApplicationID: "d1", LeadNUID: "a"}, {ApplicationID: "d2", LeadNUID: "a"}, {ApplicationID: "d3", LeadNUID: "a"}, {ApplicationID: "d4", LeadNUID: "a"}}
	only := roleOpening(roleB, []string{"a"}, 1, "e1", "e2")
	plan, _, err := planOpenings("c1", []opening{busy, only}, []string{roleB})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Positions[0].Short != 0 || plan.Positions[0].Added != 2 {
		t.Errorf("a is the only reviewer, so covers both despite being over fair share: %+v", plan.Positions[0])
	}
}

func TestBuildOpeningsKeepsOnlyPoolWork(t *testing.T) {
	pool := []models.ApplicationSummary{app("a1", "u1", roleA, models.StageSubmitted), app("a2", "u2", roleB, models.StageLeadReview)}
	reviewers := []assignedReviewer{{ApplicationID: "a2", LeadNUID: "l1"}, {ApplicationID: "gone", LeadNUID: "l1"}}
	blocked := staffing.Blocked{}
	blocked.Add("a1", "l2")
	got := buildOpenings([]string{roleA, roleB}, map[string][]string{roleA: {"l1", "l2"}}, 3, pool, reviewers, blocked)
	if !slices.Equal(got[0].appIDs, []string{"a1"}) || !got[0].blocked["a1"]["l2"] || got[0].coverage != 2 {
		t.Errorf("opening A: %+v", got[0])
	}
	if len(got[1].prior) != 1 || len(got[1].reviewers) != 0 || len(got[1].warnings) != 1 {
		t.Errorf("opening B: %+v", got[1])
	}
}

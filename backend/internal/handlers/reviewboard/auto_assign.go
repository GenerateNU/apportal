package reviewboard

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const maxAutoAssignRoles = 100

type AutoAssignInput struct {
	middleware.DryRunQuery
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleIDs []string `json:"role_ids,omitempty" maxItems:"100" doc:"Openings to assign; empty means every opening. Load from the others still counts toward balance"`
	}
}

type AutoAssignResult struct {
	RoleID     string   `json:"role_id"`
	Applicants int      `json:"applicants" doc:"Applicants waiting on reviews"`
	Reviewers  int      `json:"reviewers" doc:"Staff who can review this opening"`
	Coverage   int      `json:"coverage" doc:"Reviewers each applicant gets"`
	Added      int      `json:"added" doc:"New assignments this run makes"`
	Short      int      `json:"short" doc:"Applicants still below coverage afterwards"`
	Warnings   []string `json:"warnings"`
}

type LeadLoad struct {
	LeadNUID string `json:"lead_nuid"`
	FullName string `json:"full_name"`
	Existing int    `json:"existing" doc:"Pending reviews they already have, across every opening"`
	Added    int    `json:"added" doc:"Reviews this run gives them"`
}

type PlannedPair struct {
	ApplicationID string `json:"application_id"`
	LeadNUID      string `json:"lead_nuid"`
}

type AutoAssignPlan struct {
	Positions []AutoAssignResult `json:"positions"`
	Leads     []LeadLoad         `json:"leads"`
	New       []PlannedPair      `json:"new" doc:"Assignments this run adds"`
}

type AutoAssignOutput struct {
	Body AutoAssignPlan
}

func (s *reviewService) autoAssign(ctx context.Context, in *AutoAssignInput) (*AutoAssignOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	requested, err := parseRoleIDs(in.Body.RoleIDs)
	if err != nil {
		return nil, err
	}
	dryRun := middleware.IntentFrom(ctx).DryRun
	var plan AutoAssignPlan
	run := func(store reviewStore) error {
		p, pairs, err := s.planAuto(ctx, store, in.ID, requested)
		if err != nil {
			return err
		}
		plan = p
		if dryRun || len(pairs) == 0 {
			return nil
		}
		var added []string
		for _, pos := range p.Positions {
			if pos.Added > 0 {
				added = append(added, pos.RoleID)
			}
		}
		if err := s.staff.RequireAdd(ctx, in.ID, added, models.KindReviewer); err != nil {
			return err
		}
		if _, err := store.SaveAssignments(ctx, pairs, utils.CurrentActor(ctx).NUID); err != nil {
			return utils.StoreErr(err)
		}
		return nil
	}
	if dryRun {
		err = run(s.store)
	} else {
		err = s.store.Locked(ctx, in.ID, run)
	}
	if err != nil {
		var se huma.StatusError
		if !errors.As(err, &se) {
			err = utils.StoreErr(err)
		}
		return nil, err
	}
	return &AutoAssignOutput{Body: plan}, nil
}

// Applicants still waiting on lead reviews: submitted, or already in lead review.
var reviewPoolStages = []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview}

func parseRoleIDs(ids []string) ([]string, error) {
	if len(ids) > maxAutoAssignRoles {
		return nil, huma.Error422UnprocessableEntity("too many role_ids")
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, err := uuid.Parse(id); err != nil {
			return nil, huma.Error422UnprocessableEntity("invalid role_id " + id)
		}
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out, nil
}

func (s *reviewService) planAuto(ctx context.Context, store reviewStore, cycleID string, requested []string) (AutoAssignPlan, []assign.Pair, error) {
	roleIDs, err := store.RoleIDs(ctx, cycleID)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}
	for _, id := range requested {
		if !slices.Contains(roleIDs, id) {
			return AutoAssignPlan{}, nil, huma.Error422UnprocessableEntity("role_id " + id + " isn't an opening on this cycle")
		}
	}
	pool, err := s.staff.ForKind(ctx, cycleID, models.KindReviewer)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}
	frozen := map[string]bool{}
	for id, err := range pool.Blocked {
		frozen[id] = err != nil
	}
	for _, id := range requested {
		if err := pool.Blocked[id]; err != nil {
			return AutoAssignPlan{}, nil, err
		}
	}
	if len(requested) == 0 {
		requested = roleIDs
	}
	if err := pool.RequireLimit(models.KindReviewer); err != nil {
		return AutoAssignPlan{}, nil, staffing.HTTPError(err)
	}
	perApplicant, eligible := pool.Limit, pool.Eligible
	staff, err := store.Staff(ctx, cycleID)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}
	apps, err := store.Applications(ctx, cycleID, reviewPoolStages)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}
	reviewers, err := store.Reviewers(ctx, cycleID, reviewPoolStages)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}
	blocked, err := store.Blocked(ctx, cycleID)
	if err != nil {
		return AutoAssignPlan{}, nil, utils.StoreErr(err)
	}

	openings := buildOpenings(roleIDs, eligible, perApplicant, apps, reviewers, blocked)
	for i := range openings {
		openings[i].frozen = frozen[openings[i].roleID]
	}
	plan, pairs, err := planOpenings(cycleID, openings, requested)
	if err != nil {
		return AutoAssignPlan{}, nil, err
	}
	plan.Leads = leadLoads(staff, plan.Leads)
	return plan, pairs, nil
}

type opening struct {
	roleID    string
	reviewers []string
	appIDs    []string
	prior     []assign.Pair
	blocked   staffing.Blocked
	coverage  int
	warnings  []string
	frozen    bool
}

func buildOpenings(roleIDs []string, eligible map[string][]string, perApplicant int, pool []models.ApplicationSummary,
	reviewers []assignedReviewer, blocked staffing.Blocked) []opening {
	byRole := make(map[string]*opening, len(roleIDs))
	out := make([]opening, len(roleIDs))
	for i, id := range roleIDs {
		out[i] = opening{roleID: id, reviewers: eligible[id], blocked: staffing.Blocked{}}
		out[i].coverage, out[i].warnings = clampCoverage(perApplicant, len(eligible[id]))
		byRole[id] = &out[i]
	}
	appRole := make(map[string]string, len(pool))
	for _, a := range pool {
		o := byRole[a.RoleID]
		if o == nil {
			continue
		}
		appRole[a.ID] = a.RoleID
		o.appIDs = append(o.appIDs, a.ID)
		for n := range blocked[a.ID] {
			o.blocked.Add(a.ID, n)
		}
	}
	for _, r := range reviewers {
		if o := byRole[appRole[r.ApplicationID]]; o != nil {
			o.prior = append(o.prior, assign.Pair{ApplicationID: r.ApplicationID, LeadNUID: r.LeadNUID})
		}
	}
	return out
}

func planOpenings(cycleID string, openings []opening, requested []string) (AutoAssignPlan, []assign.Pair, error) {
	loads := map[string]int{}
	for _, o := range openings {
		for _, p := range o.prior {
			loads[p.LeadNUID]++
		}
	}
	existing := make(map[string]int, len(loads))
	for n, c := range loads {
		existing[n] = c
	}

	order := make([]opening, 0, len(requested))
	for _, o := range openings {
		if slices.Contains(requested, o.roleID) {
			order = append(order, o)
		}
	}
	slices.SortStableFunc(order, func(a, b opening) int { return len(a.reviewers) - len(b.reviewers) })

	plan := AutoAssignPlan{Positions: make([]AutoAssignResult, 0, len(order)), New: []PlannedPair{}}
	var pairs []assign.Pair
	added := map[string]int{}
	for _, o := range order {
		res, newPairs, err := planOpening(cycleID, o, loads)
		if err != nil {
			return AutoAssignPlan{}, nil, err
		}
		for _, p := range newPairs {
			loads[p.LeadNUID]++
			added[p.LeadNUID]++
			plan.New = append(plan.New, PlannedPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID})
		}
		pairs = append(pairs, newPairs...)
		plan.Positions = append(plan.Positions, res)
	}
	slices.SortStableFunc(plan.Positions, func(a, b AutoAssignResult) int {
		return slices.Index(requested, a.RoleID) - slices.Index(requested, b.RoleID)
	})
	for n := range loads {
		if existing[n]+added[n] > 0 {
			plan.Leads = append(plan.Leads, LeadLoad{LeadNUID: n, Existing: existing[n], Added: added[n]})
		}
	}
	slices.SortFunc(plan.Leads, func(a, b LeadLoad) int { return cmp.Compare(a.LeadNUID, b.LeadNUID) })
	return plan, pairs, nil
}

func planOpening(cycleID string, o opening, loads map[string]int) (AutoAssignResult, []assign.Pair, error) {
	res := AutoAssignResult{RoleID: o.roleID, Applicants: len(o.appIDs), Reviewers: len(o.reviewers), Coverage: o.coverage, Warnings: o.warnings}
	if o.frozen {
		res.Warnings = append(res.Warnings, "Reviews are frozen for this opening because the next step has started.")
		return res, nil, nil
	}
	if len(o.appIDs) == 0 || len(o.reviewers) == 0 {
		return res, nil, nil
	}
	prior := map[string]int{}
	for _, p := range o.prior {
		prior[p.LeadNUID]++
	}
	need := 0
	depth := map[string]int{}
	for _, p := range o.prior {
		depth[p.ApplicationID]++
	}
	for _, id := range o.appIDs {
		need += max(o.coverage-depth[id], 0)
	}

	budgets := fairFill(o.reviewers, loads, map[string]int{}, need)
	var plan assign.Plan
	for first := true; ; first = false {
		caps := make(map[string]int, len(o.reviewers))
		for _, n := range o.reviewers {
			caps[n] = prior[n] + budgets[n]
		}
		next, err := assign.Compute(assign.Input{
			ApplicationIDs: o.appIDs,
			Teams:          soloTeams(o.reviewers),
			Existing:       o.prior,
			Cap:            1,
			CapOverrides:   caps,
			Coverage:       o.coverage,
			Seed:           assign.SeedFrom(cycleID, o.roleID, "auto"),
			Blocked:        o.blocked,
		})
		if err != nil {
			return res, nil, huma.Error422UnprocessableEntity(err.Error())
		}
		improved := first || len(next.New) > len(plan.New)
		if improved {
			plan = next
		}
		short := need - len(plan.New)
		if short <= 0 || !improved {
			break
		}
		// Conflicts stranded some budget; give the shortfall to whoever is least loaded and retry.
		budgets = fairFill(o.reviewers, loads, budgets, short)
	}

	res.Added = len(plan.New)
	res.Short = len(plan.UnderCovered)
	if res.Short > 0 {
		res.Warnings = append(res.Warnings, fmt.Sprintf("%d applicant(s) still need reviewers: too few reviewers without a conflict.", res.Short))
	}
	return res, plan.New, nil
}

func fairFill(reviewers []string, loads, budgets map[string]int, n int) map[string]int {
	out := make(map[string]int, len(reviewers))
	for _, r := range reviewers {
		out[r] = budgets[r]
	}
	for ; n > 0; n-- {
		best := ""
		for _, r := range reviewers {
			if best == "" || loads[r]+out[r] < loads[best]+out[best] {
				best = r
			}
		}
		out[best]++
	}
	return out
}

func leadLoads(staff []models.CycleStaffMember, loads []LeadLoad) []LeadLoad {
	byNUID := make(map[string]LeadLoad, len(loads))
	for _, l := range loads {
		byNUID[l.LeadNUID] = l
	}
	out := make([]LeadLoad, 0, len(loads))
	for _, m := range staff {
		if l, ok := byNUID[m.UserNUID]; ok {
			l.FullName = m.FullName
			out = append(out, l)
			delete(byNUID, m.UserNUID)
		}
	}
	for _, l := range loads {
		if _, left := byNUID[l.LeadNUID]; left {
			out = append(out, l)
		}
	}
	return out
}

func soloTeams(nuids []string) []assign.Team {
	teams := make([]assign.Team, len(nuids))
	for i, n := range nuids {
		teams[i] = assign.Team{Name: n, LeadNUIDs: []string{n}}
	}
	return teams
}

func clampCoverage(wanted, reviewers int) (int, []string) {
	if reviewers == 0 {
		return wanted, []string{"No one can review this opening yet."}
	}
	if wanted > reviewers {
		return reviewers, []string{"Fewer reviewers than the reviewers-each setting, so each applicant gets everyone available."}
	}
	return wanted, []string{}
}

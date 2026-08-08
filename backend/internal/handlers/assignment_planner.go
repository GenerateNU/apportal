package handlers

import (
	"cmp"
	"context"
	"net/http"
	"slices"
	"strconv"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// Assignment planning: a chief groups leads into teams, sizes the per-lead cap,
// previews who would review what, and then commits. Capacity and preview are
// read-only; commit is the only write, and it re-plans server-side rather than
// trusting the client's preview. Teams are supplied per request rather than
// stored, so a chief can regroup leads freely between runs — which means
// existing assignments are interpreted through whatever teams the current
// request declares.

type assignmentPlannerHandler struct {
	store *store.Store
}

// reviewPoolStages are the stages an application can be in and still need lead
// reviews: freshly submitted, or already partway through lead review.
var reviewPoolStages = []models.ApplicationStage{
	models.StageSubmitted,
	models.StageLeadReview,
}

func (h *assignmentPlannerHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "suggest-assignment-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/capacity",
		Summary:     "Suggest a per-lead review cap for a team layout",
		Description: "Chief only. Read-only. Given teams and a coverage target, reports the " +
			"minimum and suggested per-lead cap for the cycle's unreviewed pool. Because two " +
			"leads on the same team never review the same application, a team can absorb at " +
			"most one review per application — so the minimum cap can exceed a naive even split.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.capacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-assignment-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/preview",
		Summary:     "Preview lead review assignments for a team layout",
		Description: "Chief only. Read-only — computes which applications each lead would " +
			"review and returns them without saving. Existing assignments are treated as " +
			"fixed: the plan only adds what is missing.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.preview)

	huma.Register(api, huma.Operation{
		OperationID: "commit-assignment-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/assignment-plan/commit",
		Summary:     "Assign leads according to a plan",
		Description: "Chief only. Writes the plan's assignments. The plan is recomputed " +
			"server-side against the pool as it stands now rather than trusting a supplied " +
			"list, and existing assignments are never deleted or reassigned — so committing " +
			"the same plan twice creates nothing the second time.",
		Tags:          []string{"Assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.commit)

	huma.Register(api, huma.Operation{
		OperationID: "get-assignment-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/assignment-plan/pool",
		Summary:     "Count the applications awaiting lead review",
		Description: "Chief only. The size of the pool a plan would cover, for sizing caps " +
			"before any teams are built.",
		Tags:   []string{"Assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.pool)
}

// PlanTeam is a group of leads who review together, named by the chief.
type PlanTeam struct {
	Name      string   `json:"name" doc:"Display name for the team"`
	LeadNUIDs []string `json:"lead_nuids" minItems:"1" doc:"NUIDs of the leads on this team"`
}

func toAssignTeams(in []PlanTeam) []assign.Team {
	out := make([]assign.Team, len(in))
	for i, t := range in {
		out[i] = assign.Team{Name: t.Name, LeadNUIDs: t.LeadNUIDs}
	}
	return out
}

// --- capacity ---

type CapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role     models.Role `json:"role" doc:"Applicant role whose pool is being planned"`
		Teams    []PlanTeam  `json:"teams"`
		Coverage int         `json:"coverage" minimum:"1" doc:"How many distinct leads should review each application"`
		// ExcludedApplicationIDs are left out of the pool for this call only —
		// supplied per request rather than stored, same as Teams.
		ExcludedApplicationIDs []string `json:"excluded_application_ids,omitempty"`
	}
}

type CapacityOutput struct {
	Body assign.Capacity
}

func (h *assignmentPlannerHandler) capacity(ctx context.Context, in *CapacityInput) (*CapacityOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := h.reviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	out, err := assign.SuggestCapacity(assign.CapacityInput{
		Applications: len(pool),
		Teams:        toAssignTeams(in.Body.Teams),
		Coverage:     in.Body.Coverage,
	})
	if err != nil {
		return nil, huma.Error422UnprocessableEntity(err.Error())
	}
	return &CapacityOutput{Body: out}, nil
}

// --- preview ---

type PreviewPlanInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         models.Role    `json:"role"`
		Teams        []PlanTeam     `json:"teams"`
		Coverage     int            `json:"coverage" minimum:"1"`
		Cap          int            `json:"cap" minimum:"1" doc:"Maximum applications per lead"`
		CapOverrides map[string]int `json:"cap_overrides,omitempty" doc:"Per-lead cap overrides, keyed by NUID"`
		// ExcludedApplicationIDs are left out of the pool for this call only —
		// supplied per request rather than stored, same as Teams. Commit
		// re-reads this from its own request body, so an excluded application
		// stays excluded only for as long as the chief keeps sending its ID.
		ExcludedApplicationIDs []string `json:"excluded_application_ids,omitempty"`
	}
}

// PlannedApplication identifies an application in a preview, with enough detail
// to recognise the applicant without a second lookup.
type PlannedApplication struct {
	ApplicationID string `json:"application_id"`
	ApplicantNUID string `json:"applicant_nuid"`
	FullName      string `json:"full_name"`
	Email         string `json:"email"`
	// AlreadyAssigned marks a review this lead was already assigned, as opposed
	// to one this plan is proposing to add.
	AlreadyAssigned bool `json:"already_assigned"`
}

// PlannedLead is one lead's proposed review queue.
type PlannedLead struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	TeamName     string               `json:"team_name"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// AssignmentPlanPreview is the whole proposal: per-lead queues plus the
// coverage picture across the pool.
type AssignmentPlanPreview struct {
	PoolSize int           `json:"pool_size"`
	Coverage int           `json:"coverage"`
	Leads    []PlannedLead `json:"leads"`
	// CoverageCounts maps a reviewer count to how many applications have
	// exactly that many reviewers under the plan.
	CoverageCounts map[string]int `json:"coverage_counts"`
	// UnderCovered lists applications the plan could not fully cover.
	UnderCovered []PlannedApplication `json:"under_covered"`
	Warnings     []string             `json:"warnings"`
	// TotalAdded is how many assignments would be created on commit.
	TotalAdded int `json:"total_added"`
}

type PreviewPlanOutput struct {
	Body AssignmentPlanPreview
}

func (h *assignmentPlannerHandler) preview(ctx context.Context, in *PreviewPlanInput) (*PreviewPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	planned, err := h.buildPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	body, err := h.decoratePlan(ctx, planned)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreviewPlanOutput{Body: body}, nil
}

// plannedRun bundles a computed plan with the context needed to describe or
// persist it, so preview and commit can share one planning path.
type plannedRun struct {
	plan     assign.Plan
	prior    []assign.Pair
	byID     map[string]models.ApplicationSummary
	appIDs   []string
	coverage int
}

// buildPlan reads the current pool and existing assignments, then computes a
// plan. Commit re-runs this rather than trusting a client-supplied list of
// pairs: the server stays the authority on who may review what, and the plan
// is recomputed against the pool as it stands at write time.
func (h *assignmentPlannerHandler) buildPlan(ctx context.Context, in *PreviewPlanInput) (plannedRun, error) {
	if !in.Body.Role.Valid() {
		return plannedRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Teams) == 0 {
		return plannedRun{}, huma.Error422UnprocessableEntity("at least one team is required")
	}

	pool, err := h.reviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return plannedRun{}, storeErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)
	existing, err := h.store.ListLeadAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return plannedRun{}, storeErr(err)
	}

	appIDs := make([]string, len(pool))
	byID := make(map[string]models.ApplicationSummary, len(pool))
	for i, a := range pool {
		appIDs[i] = a.ID
		byID[a.ID] = a
	}

	// Only existing assignments against applications still in the pool matter;
	// anything past lead review is settled and must not consume cap here.
	prior := make([]assign.Pair, 0, len(existing))
	for _, e := range existing {
		if _, inPool := byID[e.ApplicationID]; inPool {
			prior = append(prior, assign.Pair{ApplicationID: e.ApplicationID, LeadNUID: e.LeadNUID})
		}
	}

	plan, err := assign.Compute(assign.Input{
		ApplicationIDs: appIDs,
		Teams:          toAssignTeams(in.Body.Teams),
		Existing:       prior,
		Cap:            in.Body.Cap,
		CapOverrides:   in.Body.CapOverrides,
		Coverage:       in.Body.Coverage,
		Seed:           assign.SeedFrom(in.ID, string(in.Body.Role)),
	})
	if err != nil {
		return plannedRun{}, huma.Error422UnprocessableEntity(err.Error())
	}

	return plannedRun{
		plan:     plan,
		prior:    prior,
		byID:     byID,
		appIDs:   appIDs,
		coverage: in.Body.Coverage,
	}, nil
}

// --- commit ---

// CommitPlanOutput reports what was actually written, alongside the plan as it
// stood at write time so the UI can show the committed result rather than the
// preview it was built from.
type CommitPlanOutput struct {
	Body struct {
		// Created is how many assignments this commit inserted. Re-committing an
		// unchanged plan reports 0 — the rows already exist.
		Created int                   `json:"created"`
		Plan    AssignmentPlanPreview `json:"plan"`
	}
}

func (h *assignmentPlannerHandler) commit(ctx context.Context, in *PreviewPlanInput) (*CommitPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	planned, err := h.buildPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]store.LeadAssignmentPair, len(planned.plan.New))
	for i, p := range planned.plan.New {
		pairs[i] = store.LeadAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}

	created, err := h.store.CreateLeadAssignments(ctx, pairs, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}

	body, err := h.decoratePlan(ctx, planned)
	if err != nil {
		return nil, storeErr(err)
	}

	out := &CommitPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

// decoratePlan turns the planner's ID-level output into something a chief can
// read: applicant names against each lead's queue, and the leads' own names.
func (h *assignmentPlannerHandler) decoratePlan(
	ctx context.Context,
	run plannedRun,
) (AssignmentPlanPreview, error) {
	plan, prior, byID := run.plan, run.prior, run.byID

	leadNames, err := h.leadNames(ctx)
	if err != nil {
		return AssignmentPlanPreview{}, err
	}

	queues := make(map[string][]PlannedApplication)
	add := func(nuid, appID string, already bool) {
		a, ok := byID[appID]
		if !ok {
			return
		}
		queues[nuid] = append(queues[nuid], PlannedApplication{
			ApplicationID:   a.ID,
			ApplicantNUID:   a.UserNUID,
			FullName:        a.FullName,
			Email:           a.Email,
			AlreadyAssigned: already,
		})
	}
	for _, p := range prior {
		add(p.LeadNUID, p.ApplicationID, true)
	}
	for _, p := range plan.New {
		add(p.LeadNUID, p.ApplicationID, false)
	}

	leads := make([]PlannedLead, 0, len(plan.Loads))
	for _, l := range plan.Loads {
		q := queues[l.LeadNUID]
		sortPlannedApplications(q)
		leads = append(leads, PlannedLead{
			LeadNUID:     l.LeadNUID,
			FullName:     leadNames[l.LeadNUID],
			TeamName:     l.TeamName,
			Cap:          l.Cap,
			Existing:     l.Existing,
			Added:        l.Added,
			Total:        l.Total,
			Applications: q,
		})
	}

	// Huma renders map keys as strings; convert the int-keyed histogram so the
	// generated client sees a plain object.
	counts := make(map[string]int, len(plan.CoverageCounts))
	for depth, n := range plan.CoverageCounts {
		counts[strconv.Itoa(depth)] = n
	}

	under := make([]PlannedApplication, 0, len(plan.UnderCovered))
	for _, id := range plan.UnderCovered {
		if a, ok := byID[id]; ok {
			under = append(under, PlannedApplication{
				ApplicationID: a.ID,
				ApplicantNUID: a.UserNUID,
				FullName:      a.FullName,
				Email:         a.Email,
			})
		}
	}

	return AssignmentPlanPreview{
		PoolSize:       len(run.appIDs),
		Coverage:       run.coverage,
		Leads:          leads,
		CoverageCounts: counts,
		UnderCovered:   under,
		Warnings:       plan.Warnings,
		TotalAdded:     len(plan.New),
	}, nil
}

// --- pool ---

type PoolInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

// PoolApplicant identifies one application in the pool, with enough detail to
// recognise the applicant without a second lookup — used by the chief to pick
// which applicants to exclude before planning.
type PoolApplicant struct {
	ApplicationID string `json:"application_id"`
	FullName      string `json:"full_name"`
	Email         string `json:"email"`
}

type PoolOutput struct {
	Body struct {
		PoolSize int `json:"pool_size"`
		// LeadCount is how many leads exist to draw teams from.
		LeadCount int `json:"lead_count"`
		// Applicants is the full pool, unfiltered by any exclusion — the chief
		// checks some of these off to exclude them from capacity/preview/commit.
		Applicants []PoolApplicant `json:"applicants"`
	}
}

func (h *assignmentPlannerHandler) pool(ctx context.Context, in *PoolInput) (*PoolOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := h.reviewPool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	names, err := h.leadNames(ctx)
	if err != nil {
		return nil, storeErr(err)
	}

	applicants := make([]PoolApplicant, len(pool))
	for i, a := range pool {
		applicants[i] = PoolApplicant{ApplicationID: a.ID, FullName: a.FullName, Email: a.Email}
	}

	out := &PoolOutput{}
	out.Body.PoolSize = len(pool)
	out.Body.LeadCount = len(names)
	out.Body.Applicants = applicants
	return out, nil
}

// --- shared ---

// reviewPool is the set of applications a plan would cover: submitted or
// mid-lead-review, for one role in one cycle.
func (h *assignmentPlannerHandler) reviewPool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, error) {
	return h.store.ListApplications(ctx, store.ApplicationFilter{
		CycleID: cycleID,
		Role:    &role,
		Stages:  reviewPoolStages,
	})
}

// excludeApplications drops any pool entries whose ID is in excludeIDs — a
// chief keeping specific applicants out of this planning run. Supplied per
// request rather than stored, same as Teams.
func excludeApplications(pool []models.ApplicationSummary, excludeIDs []string) []models.ApplicationSummary {
	if len(excludeIDs) == 0 {
		return pool
	}
	excluded := make(map[string]bool, len(excludeIDs))
	for _, id := range excludeIDs {
		excluded[id] = true
	}
	out := make([]models.ApplicationSummary, 0, len(pool))
	for _, a := range pool {
		if !excluded[a.ID] {
			out = append(out, a)
		}
	}
	return out
}

func (h *assignmentPlannerHandler) leadNames(ctx context.Context) (map[string]string, error) {
	role := models.UserRoleLead
	users, _, err := h.store.ListUsers(ctx, &role, nil, 0)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(users))
	for _, u := range users {
		out[u.NUID] = u.FullName
	}
	return out, nil
}

func sortPlannedApplications(q []PlannedApplication) {
	slices.SortStableFunc(q, func(a, b PlannedApplication) int {
		if c := cmp.Compare(a.FullName, b.FullName); c != 0 {
			return c
		}
		return cmp.Compare(a.ApplicationID, b.ApplicationID)
	})
}

package assignmentplanner

import (
	"cmp"
	"context"
	"slices"
	"strconv"

	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// Assignment planning: a chief groups leads into teams, sizes the per-lead cap,
// previews who would review what, and then commits. Capacity and preview are
// read-only; commit is the only write, and it re-plans server-side rather than
// trusting the client's preview. Teams are supplied per request rather than
// stored, so a chief can regroup leads freely between runs — which means
// existing assignments are interpreted through whatever teams the current
// request declares.
type assignmentPlannerService struct {
	applicationDB    *application.ApplicationDB
	leadAssignmentDB *leadassignment.LeadAssignmentDB
	userDB           *user.UserDB
}

// reviewPoolStages are the stages an application can be in and still need lead
// reviews: freshly submitted, or already partway through lead review.
var reviewPoolStages = []models.ApplicationStage{
	models.StageSubmitted,
	models.StageLeadReview,
}

func toAssignTeams(in []PlanTeam) []assign.Team {
	out := make([]assign.Team, len(in))
	for i, t := range in {
		out[i] = assign.Team{Name: t.Name, LeadNUIDs: t.LeadNUIDs}
	}
	return out
}

func (s *assignmentPlannerService) capacity(ctx context.Context, in *CapacityInput) (*CapacityOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := s.reviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
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

func (s *assignmentPlannerService) preview(ctx context.Context, in *PreviewPlanInput) (*PreviewPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	planned, err := s.buildPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	body, err := s.decoratePlan(ctx, planned)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreviewPlanOutput{Body: body}, nil
}

// buildPlan reads the current pool and existing assignments, then computes a
// plan. Commit re-runs this rather than trusting a client-supplied list of
// pairs: the server stays the authority on who may review what, and the plan
// is recomputed against the pool as it stands at write time.
func (s *assignmentPlannerService) buildPlan(ctx context.Context, in *PreviewPlanInput) (plannedRun, error) {
	if !in.Body.Role.Valid() {
		return plannedRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Teams) == 0 {
		return plannedRun{}, huma.Error422UnprocessableEntity("at least one team is required")
	}

	pool, err := s.reviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return plannedRun{}, utils.StoreErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)
	existing, err := s.leadAssignmentDB.ListLeadAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return plannedRun{}, utils.StoreErr(err)
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

func (s *assignmentPlannerService) commit(ctx context.Context, in *PreviewPlanInput) (*CommitPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	planned, err := s.buildPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]leadassignment.LeadAssignmentPair, len(planned.plan.New))
	for i, p := range planned.plan.New {
		pairs[i] = leadassignment.LeadAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}

	created, err := s.leadAssignmentDB.CreateLeadAssignments(ctx, pairs, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	newlyAssigned := make(map[string]bool, len(planned.plan.New))
	for _, p := range planned.plan.New {
		newlyAssigned[p.ApplicationID] = true
	}
	appIDs := make([]string, 0, len(newlyAssigned))
	for id := range newlyAssigned {
		appIDs = append(appIDs, id)
	}
	if _, err := s.applicationDB.AdvanceApplicationsToLeadReview(ctx, appIDs); err != nil {
		return nil, utils.StoreErr(err)
	}

	body, err := s.decoratePlan(ctx, planned)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &CommitPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

// decoratePlan turns the planner's ID-level output into something a chief can
// read: applicant names against each lead's queue, and the leads' own names.
func (s *assignmentPlannerService) decoratePlan(
	ctx context.Context,
	run plannedRun,
) (AssignmentPlanPreview, error) {
	plan, prior, byID := run.plan, run.prior, run.byID

	leadNames, err := s.leadNames(ctx)
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

func (s *assignmentPlannerService) pool(ctx context.Context, in *PoolInput) (*PoolOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := s.reviewPool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	names, err := s.leadNames(ctx)
	if err != nil {
		return nil, utils.StoreErr(err)
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
func (s *assignmentPlannerService) reviewPool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, error) {
	return s.applicationDB.ListApplications(ctx, application.ApplicationFilter{
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

func (s *assignmentPlannerService) leadNames(ctx context.Context) (map[string]string, error) {
	role := models.UserRoleLead
	users, _, err := s.userDB.ListUsers(ctx, &role, nil, 0)
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

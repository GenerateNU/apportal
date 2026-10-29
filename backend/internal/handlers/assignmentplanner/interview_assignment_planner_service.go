package assignmentplanner

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/interviewassign"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// Interview assignment planning: a chief declares each lead's meeting day for
// this run, sizes a per-lead cap, previews who would interview/review whom,
// and commits. Like the written-review planner, capacity and preview are
// read-only, commit re-plans server-side rather than trusting the client, and
// meeting days are supplied per request rather than stored — a chief can
// redeclare them freely between runs.
//
// Two stages, run in sequence: interviewer assignment (one per applicant,
// day-matched, softly avoiding a lead who already wrote that applicant's
// review), then interview-review assignment (Coverage reviewers per
// applicant, day-matched, softly avoiding a lead who shares the assigned
// interviewer's day). The reviewer stage reads interviewers from the live
// database, so it only sees applicants whose interviewer has already been
// committed — not merely previewed.
type interviewAssignmentPlannerService struct {
	applicationDB         *application.ApplicationDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	leadAssignmentDB      *leadassignment.LeadAssignmentDB
	userDB                *user.UserDB
}

func toInterviewassignLeads(in []PlanLeadDay) []interviewassign.Lead {
	out := make([]interviewassign.Lead, len(in))
	for i, l := range in {
		out[i] = interviewassign.Lead{NUID: l.LeadNUID, Day: l.Day}
	}
	return out
}

// toConflictMap groups conflicts by application, the shape both planning
// stages need to look up a given applicant's excluded leads.
func toConflictMap(in []PlanConflict) map[string]map[string]bool {
	out := make(map[string]map[string]bool, len(in))
	for _, c := range in {
		if out[c.ApplicationID] == nil {
			out[c.ApplicationID] = make(map[string]bool)
		}
		out[c.ApplicationID][c.LeadNUID] = true
	}
	return out
}

func (s *interviewAssignmentPlannerService) interviewerPool(ctx context.Context, in *InterviewPoolInput) (*InterviewPoolOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := s.interviewPool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	names, err := s.leadNames(ctx)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &InterviewPoolOutput{}
	out.Body.PoolSize = len(pool)
	out.Body.LeadCount = len(names)
	out.Body.Applicants = toPoolApplicants(pool)
	return out, nil
}

func (s *interviewAssignmentPlannerService) interviewerCapacity(ctx context.Context, in *InterviewerCapacityInput) (*InterviewerCapacityOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := s.interviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	out, err := interviewassign.SuggestCapacity(interviewassign.CapacityInput{
		Applicants: len(pool),
		Leads:      len(in.Body.Leads),
		Coverage:   1,
	})
	if err != nil {
		return nil, huma.Error422UnprocessableEntity(err.Error())
	}
	return &InterviewerCapacityOutput{Body: out}, nil
}

func (s *interviewAssignmentPlannerService) buildInterviewerPlan(ctx context.Context, in *InterviewerPreviewInput) (interviewerRun, error) {
	if !in.Body.Role.Valid() {
		return interviewerRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Leads) == 0 {
		return interviewerRun{}, huma.Error422UnprocessableEntity("at least one lead is required")
	}

	pool, err := s.interviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, utils.StoreErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	existingRows, err := s.interviewAssignmentDB.ListInterviewAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, utils.StoreErr(err)
	}

	appIDs := make([]string, len(pool))
	byID := make(map[string]models.ApplicationSummary, len(pool))
	applicants := make([]interviewassign.Applicant, len(pool))
	for i, a := range pool {
		appIDs[i] = a.ID
		byID[a.ID] = a
		applicants[i] = interviewassign.Applicant{ApplicationID: a.ID, AvailableDays: parseAvailability(a.Availability)}
	}

	// Only existing assignments against applications still in the pool
	// matter; anything past the interview stage is settled.
	existing := make(map[string]string, len(existingRows))
	for _, e := range existingRows {
		if _, inPool := byID[e.ApplicationID]; inPool {
			existing[e.ApplicationID] = e.InterviewerNUID
		}
	}

	wroteReview, err := s.wroteReviewByApplication(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, utils.StoreErr(err)
	}

	plan, err := interviewassign.PlanInterviewers(interviewassign.InterviewerInput{
		Applicants:   applicants,
		Leads:        toInterviewassignLeads(in.Body.Leads),
		Existing:     existing,
		WroteReview:  wroteReview,
		Conflicts:    toConflictMap(in.Body.Conflicts),
		Cap:          in.Body.Cap,
		CapOverrides: in.Body.CapOverrides,
		Seed:         interviewassign.SeedFrom(in.ID, string(in.Body.Role), "interviewer"),
	})
	if err != nil {
		return interviewerRun{}, huma.Error422UnprocessableEntity(err.Error())
	}

	return interviewerRun{plan: plan, prior: existing, byID: byID, appIDs: appIDs}, nil
}

func (s *interviewAssignmentPlannerService) interviewerPreview(ctx context.Context, in *InterviewerPreviewInput) (*PreviewInterviewerPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	run, err := s.buildInterviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}
	body, err := s.decorateInterviewerPlan(ctx, run)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreviewInterviewerPlanOutput{Body: body}, nil
}

func (s *interviewAssignmentPlannerService) interviewerCommit(ctx context.Context, in *InterviewerPreviewInput) (*CommitInterviewerPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	run, err := s.buildInterviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]interviewassignment.InterviewAssignmentPair, len(run.plan.New))
	for i, p := range run.plan.New {
		pairs[i] = interviewassignment.InterviewAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}
	created, err := s.interviewAssignmentDB.CreateInterviewAssignments(ctx, pairs, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	body, err := s.decorateInterviewerPlan(ctx, run)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &CommitInterviewerPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

func (s *interviewAssignmentPlannerService) decorateInterviewerPlan(ctx context.Context, run interviewerRun) (InterviewerPlanPreview, error) {
	names, err := s.leadNames(ctx)
	if err != nil {
		return InterviewerPlanPreview{}, err
	}

	noDayMatch := make(map[string]bool, len(run.plan.NoDayMatch))
	for _, id := range run.plan.NoDayMatch {
		noDayMatch[id] = true
	}

	queues := make(map[string][]PlannedApplication)
	add := func(nuid, appID string, already bool) {
		a, ok := run.byID[appID]
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
	for appID, nuid := range run.prior {
		add(nuid, appID, true)
	}
	for _, p := range run.plan.New {
		add(p.LeadNUID, p.ApplicationID, false)
	}

	interviewers := make([]PlannedInterviewer, 0, len(run.plan.Loads))
	for _, l := range run.plan.Loads {
		q := queues[l.LeadNUID]
		sortPlannedApplications(q)
		interviewers = append(interviewers, PlannedInterviewer{
			LeadNUID:     l.LeadNUID,
			FullName:     names[l.LeadNUID],
			Day:          l.Day,
			Cap:          l.Cap,
			Existing:     l.Existing,
			Added:        l.Added,
			Total:        l.Total,
			Applications: q,
		})
	}

	toPlannedApplications := func(ids []string) []PlannedApplication {
		out := make([]PlannedApplication, 0, len(ids))
		for _, id := range ids {
			if a, ok := run.byID[id]; ok {
				out = append(out, PlannedApplication{
					ApplicationID: a.ID, ApplicantNUID: a.UserNUID, FullName: a.FullName, Email: a.Email,
				})
			}
		}
		return out
	}

	return InterviewerPlanPreview{
		PoolSize:     len(run.appIDs),
		Interviewers: interviewers,
		Unassigned:   toPlannedApplications(run.plan.Unassigned),
		NoDayMatch:   toPlannedApplications(run.plan.NoDayMatch),
		Warnings:     run.plan.Warnings,
		TotalAdded:   len(run.plan.New),
	}, nil
}

// --- reviewer pool ---
func (s *interviewAssignmentPlannerService) reviewerPool(ctx context.Context, in *InterviewPoolInput) (*InterviewPoolOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, _, err := s.reviewablePool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	names, err := s.leadNames(ctx)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &InterviewPoolOutput{}
	out.Body.PoolSize = len(pool)
	out.Body.LeadCount = len(names)
	out.Body.Applicants = toPoolApplicants(pool)
	return out, nil
}

// reviewablePool is the interview-stage applications that already have an
// interviewer assigned, alongside that interviewer's NUID per application.
func (s *interviewAssignmentPlannerService) reviewablePool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, map[string]string, error) {
	pool, err := s.interviewPool(ctx, cycleID, role)
	if err != nil {
		return nil, nil, err
	}
	assignments, err := s.interviewAssignmentDB.ListInterviewAssignmentsForCycle(ctx, cycleID, role)
	if err != nil {
		return nil, nil, err
	}
	interviewerOf := make(map[string]string, len(assignments))
	for _, a := range assignments {
		interviewerOf[a.ApplicationID] = a.InterviewerNUID
	}

	out := make([]models.ApplicationSummary, 0, len(pool))
	for _, a := range pool {
		if _, ok := interviewerOf[a.ID]; ok {
			out = append(out, a)
		}
	}
	return out, interviewerOf, nil
}

func (s *interviewAssignmentPlannerService) reviewerCapacity(ctx context.Context, in *ReviewerCapacityInput) (*ReviewerCapacityOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, _, err := s.reviewablePool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	out, err := interviewassign.SuggestCapacity(interviewassign.CapacityInput{
		Applicants: len(pool),
		Leads:      len(in.Body.Leads),
		Coverage:   in.Body.Coverage,
	})
	if err != nil {
		return nil, huma.Error422UnprocessableEntity(err.Error())
	}
	return &ReviewerCapacityOutput{Body: out}, nil
}

func (s *interviewAssignmentPlannerService) buildReviewerPlan(ctx context.Context, in *ReviewerPreviewInput) (reviewerRun, error) {
	if !in.Body.Role.Valid() {
		return reviewerRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Leads) == 0 {
		return reviewerRun{}, huma.Error422UnprocessableEntity("at least one lead is required")
	}

	pool, interviewerOf, err := s.reviewablePool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return reviewerRun{}, utils.StoreErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	appIDs := make([]string, len(pool))
	byID := make(map[string]models.ApplicationSummary, len(pool))
	applicants := make([]interviewassign.Applicant, len(pool))
	interviewer := make(map[string]string, len(pool))
	for i, a := range pool {
		appIDs[i] = a.ID
		byID[a.ID] = a
		applicants[i] = interviewassign.Applicant{ApplicationID: a.ID, AvailableDays: parseAvailability(a.Availability)}
		if nuid, ok := interviewerOf[a.ID]; ok {
			interviewer[a.ID] = nuid
		}
	}

	existingRows, err := s.interviewAssignmentDB.ListInterviewReviewAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return reviewerRun{}, utils.StoreErr(err)
	}
	prior := make([]interviewassign.ReviewerPair, 0, len(existingRows))
	for _, e := range existingRows {
		if _, inPool := byID[e.ApplicationID]; inPool {
			prior = append(prior, interviewassign.ReviewerPair{ApplicationID: e.ApplicationID, LeadNUID: e.LeadNUID})
		}
	}

	plan, err := interviewassign.PlanReviewers(interviewassign.ReviewerInput{
		Applicants:   applicants,
		Leads:        toInterviewassignLeads(in.Body.Leads),
		Interviewer:  interviewer,
		Conflicts:    toConflictMap(in.Body.Conflicts),
		Existing:     prior,
		Cap:          in.Body.Cap,
		CapOverrides: in.Body.CapOverrides,
		Coverage:     in.Body.Coverage,
		Seed:         interviewassign.SeedFrom(in.ID, string(in.Body.Role), "reviewer"),
	})
	if err != nil {
		return reviewerRun{}, huma.Error422UnprocessableEntity(err.Error())
	}

	return reviewerRun{plan: plan, prior: prior, byID: byID, appIDs: appIDs, coverage: in.Body.Coverage}, nil
}

func (s *interviewAssignmentPlannerService) reviewerPreview(ctx context.Context, in *ReviewerPreviewInput) (*PreviewInterviewReviewerPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	run, err := s.buildReviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}
	body, err := s.decorateReviewerPlan(ctx, run)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &PreviewInterviewReviewerPlanOutput{Body: body}, nil
}

func (s *interviewAssignmentPlannerService) reviewerCommit(ctx context.Context, in *ReviewerPreviewInput) (*CommitInterviewReviewerPlanOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	run, err := s.buildReviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]interviewassignment.InterviewReviewAssignmentPair, len(run.plan.New))
	for i, p := range run.plan.New {
		pairs[i] = interviewassignment.InterviewReviewAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}
	created, err := s.interviewAssignmentDB.CreateInterviewReviewAssignments(ctx, pairs, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	body, err := s.decorateReviewerPlan(ctx, run)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	out := &CommitInterviewReviewerPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

func (s *interviewAssignmentPlannerService) decorateReviewerPlan(ctx context.Context, run reviewerRun) (InterviewReviewPlanPreview, error) {
	names, err := s.leadNames(ctx)
	if err != nil {
		return InterviewReviewPlanPreview{}, err
	}

	queues := make(map[string][]PlannedApplication)
	add := func(nuid, appID string, already bool) {
		a, ok := run.byID[appID]
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
	for _, p := range run.prior {
		add(p.LeadNUID, p.ApplicationID, true)
	}
	for _, p := range run.plan.New {
		add(p.LeadNUID, p.ApplicationID, false)
	}

	reviewers := make([]PlannedReviewer, 0, len(run.plan.Loads))
	for _, l := range run.plan.Loads {
		q := queues[l.LeadNUID]
		sortPlannedApplications(q)
		reviewers = append(reviewers, PlannedReviewer{
			LeadNUID:     l.LeadNUID,
			FullName:     names[l.LeadNUID],
			Day:          l.Day,
			Cap:          l.Cap,
			Existing:     l.Existing,
			Added:        l.Added,
			Total:        l.Total,
			Applications: q,
		})
	}

	counts := make(map[string]int, len(run.plan.CoverageCounts))
	for depth, n := range run.plan.CoverageCounts {
		counts[strconv.Itoa(depth)] = n
	}

	toPlannedApplications := func(ids []string) []PlannedApplication {
		out := make([]PlannedApplication, 0, len(ids))
		for _, id := range ids {
			if a, ok := run.byID[id]; ok {
				out = append(out, PlannedApplication{
					ApplicationID: a.ID, ApplicantNUID: a.UserNUID, FullName: a.FullName, Email: a.Email,
				})
			}
		}
		return out
	}

	return InterviewReviewPlanPreview{
		PoolSize:       len(run.appIDs),
		Coverage:       run.coverage,
		Reviewers:      reviewers,
		CoverageCounts: counts,
		UnderCovered:   toPlannedApplications(run.plan.UnderCovered),
		NoDayMatch:     toPlannedApplications(run.plan.NoDayMatch),
		Warnings:       run.plan.Warnings,
		TotalAdded:     len(run.plan.New),
	}, nil
}

// --- shared ---

// interviewPool is every application in the generic interview stage — the
// same filter the manual /reviewer/interview-assignments page uses.
func (s *interviewAssignmentPlannerService) interviewPool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, error) {
	stage := models.StageInterview
	return s.applicationDB.ListApplications(ctx, application.ApplicationFilter{
		CycleID: cycleID,
		Role:    &role,
		Stage:   &stage,
	})
}

// wroteReviewByApplication maps each application to the set of lead NUIDs
// assigned to write its lead review — a lead-assignment row stands in for
// "wrote this applicant's review" (by the interview stage, lead review has
// already happened), so no join to written_reviews is needed.
func (s *interviewAssignmentPlannerService) wroteReviewByApplication(ctx context.Context, cycleID string, role models.Role) (map[string]map[string]bool, error) {
	assignments, err := s.leadAssignmentDB.ListLeadAssignmentsForCycle(ctx, cycleID, role)
	if err != nil {
		return nil, err
	}
	out := make(map[string]map[string]bool)
	for _, a := range assignments {
		if out[a.ApplicationID] == nil {
			out[a.ApplicationID] = make(map[string]bool)
		}
		out[a.ApplicationID][a.LeadNUID] = true
	}
	return out, nil
}

// leadNames maps every lead's NUID to their full name — reused to decorate
// both stages' plans, and its key set is the pool of eligible interviewers
// (chiefs are never included, since they aren't fetched here).
func (s *interviewAssignmentPlannerService) leadNames(ctx context.Context) (map[string]string, error) {
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

func toPoolApplicants(pool []models.ApplicationSummary) []PoolApplicant {
	out := make([]PoolApplicant, len(pool))
	for i, a := range pool {
		out[i] = PoolApplicant{ApplicationID: a.ID, FullName: a.FullName, Email: a.Email}
	}
	return out
}

// parseAvailability decodes an application's availability blob into a set of
// available meeting-day keys. A missing or malformed blob is treated as "no
// days available" rather than failing the whole planning request over one
// bad record — that applicant just falls through to the best-effort fallback.
func parseAvailability(raw json.RawMessage) map[string]bool {
	if len(raw) == 0 {
		return map[string]bool{}
	}
	var days map[string]bool
	if err := json.Unmarshal(raw, &days); err != nil {
		return map[string]bool{}
	}
	return days
}

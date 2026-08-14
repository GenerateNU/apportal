package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/interviewassign"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
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

type interviewAssignmentPlannerHandler struct {
	store *store.Store
}

func (h *interviewAssignmentPlannerHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-interviewer-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/pool",
		Summary:     "Count the applications awaiting an interviewer",
		Description: "Chief only. Every application in the interview stage, for sizing caps " +
			"before any meeting days are declared.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.interviewerPool)

	huma.Register(api, huma.Operation{
		OperationID: "suggest-interviewer-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/capacity",
		Summary:     "Suggest a per-lead interview cap",
		Description: "Chief only. Read-only. Reports the minimum and suggested per-lead cap " +
			"for the cycle's interview-stage pool, given how many leads are available.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.interviewerCapacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-interviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/preview",
		Summary:     "Preview interviewer assignments for a meeting-day roster",
		Description: "Chief only. Read-only — computes who would interview whom and returns " +
			"it without saving. Applications that already have an interviewer are left alone.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.interviewerPreview)

	huma.Register(api, huma.Operation{
		OperationID: "commit-interviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/interviewer/commit",
		Summary:     "Assign interviewers according to a plan",
		Description: "Chief only. Writes the plan's interviewer assignments. Recomputed " +
			"server-side against the pool as it stands now rather than trusting a supplied list.",
		Tags:          []string{"Interview assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.interviewerCommit)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview-reviewer-pool",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/pool",
		Summary:     "Count the applications awaiting interview reviewers",
		Description: "Chief only. Interview-stage applications that already have an " +
			"interviewer assigned — applicants still needing an interviewer are not counted " +
			"here (assign an interviewer first).",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.reviewerPool)

	huma.Register(api, huma.Operation{
		OperationID: "suggest-interview-reviewer-capacity",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/capacity",
		Summary:     "Suggest a per-lead interview-review cap",
		Tags:        []string{"Interview assignment planning"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.reviewerCapacity)

	huma.Register(api, huma.Operation{
		OperationID: "preview-interview-reviewer-plan",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/interview-assignment-plan/reviewer/preview",
		Summary:     "Preview interview-review assignments for a meeting-day roster",
		Description: "Chief only. Read-only. Only considers applications that already have " +
			"an interviewer committed.",
		Tags:   []string{"Interview assignment planning"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.reviewerPreview)

	huma.Register(api, huma.Operation{
		OperationID:   "commit-interview-reviewer-plan",
		Method:        http.MethodPost,
		Path:          "/cycles/{id}/interview-assignment-plan/reviewer/commit",
		Summary:       "Assign interview reviewers according to a plan",
		Tags:          []string{"Interview assignment planning"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.reviewerCommit)
}

// PlanLeadDay is a lead's declared meeting day for this planning run —
// supplied per request rather than stored, same as PlanTeam.
type PlanLeadDay struct {
	LeadNUID string `json:"lead_nuid"`
	Day      string `json:"day" minLength:"1" doc:"The lead's meeting-day key for this run (matches an applicant availability key)"`
}

func toInterviewassignLeads(in []PlanLeadDay) []interviewassign.Lead {
	out := make([]interviewassign.Lead, len(in))
	for i, l := range in {
		out[i] = interviewassign.Lead{NUID: l.LeadNUID, Day: l.Day}
	}
	return out
}

// PlannedInterviewer is one lead's proposed interview queue.
type PlannedInterviewer struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	Day          string               `json:"day"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// InterviewerPlanPreview is the whole interviewer-stage proposal.
type InterviewerPlanPreview struct {
	PoolSize     int                  `json:"pool_size"`
	Interviewers []PlannedInterviewer `json:"interviewers"`
	// Unassigned lists applicants no lead had spare capacity for.
	Unassigned []PlannedApplication `json:"unassigned"`
	// NoDayMatch lists applicants assigned despite no interviewer sharing
	// their day (the best-effort fallback fired).
	NoDayMatch []PlannedApplication `json:"no_day_match"`
	Warnings   []string             `json:"warnings"`
	TotalAdded int                  `json:"total_added"`
}

// --- interviewer pool ---

type InterviewPoolInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type InterviewPoolOutput struct {
	Body struct {
		PoolSize   int             `json:"pool_size"`
		LeadCount  int             `json:"lead_count"`
		Applicants []PoolApplicant `json:"applicants"`
	}
}

func (h *interviewAssignmentPlannerHandler) interviewerPool(ctx context.Context, in *InterviewPoolInput) (*InterviewPoolOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := h.interviewPool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	names, err := h.leadNames(ctx)
	if err != nil {
		return nil, storeErr(err)
	}

	out := &InterviewPoolOutput{}
	out.Body.PoolSize = len(pool)
	out.Body.LeadCount = len(names)
	out.Body.Applicants = toPoolApplicants(pool)
	return out, nil
}

// --- interviewer capacity ---

type InterviewerCapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role   `json:"role"`
		Leads                  []PlanLeadDay `json:"leads"`
		ExcludedApplicationIDs []string      `json:"excluded_application_ids,omitempty"`
	}
}

type InterviewerCapacityOutput struct {
	Body interviewassign.InterviewCapacity
}

func (h *interviewAssignmentPlannerHandler) interviewerCapacity(ctx context.Context, in *InterviewerCapacityInput) (*InterviewerCapacityOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, err := h.interviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, storeErr(err)
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

// --- interviewer preview/commit ---

type InterviewerPreviewInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role    `json:"role"`
		Leads                  []PlanLeadDay  `json:"leads"`
		Cap                    int            `json:"cap" minimum:"1"`
		CapOverrides           map[string]int `json:"cap_overrides,omitempty"`
		ExcludedApplicationIDs []string       `json:"excluded_application_ids,omitempty"`
	}
}

type interviewerRun struct {
	plan   interviewassign.InterviewerPlan
	prior  map[string]string
	byID   map[string]models.ApplicationSummary
	appIDs []string
}

func (h *interviewAssignmentPlannerHandler) buildInterviewerPlan(ctx context.Context, in *InterviewerPreviewInput) (interviewerRun, error) {
	if !in.Body.Role.Valid() {
		return interviewerRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Leads) == 0 {
		return interviewerRun{}, huma.Error422UnprocessableEntity("at least one lead is required")
	}

	pool, err := h.interviewPool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, storeErr(err)
	}
	pool = excludeApplications(pool, in.Body.ExcludedApplicationIDs)

	existingRows, err := h.store.ListInterviewAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, storeErr(err)
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

	wroteReview, err := h.wroteReviewByApplication(ctx, in.ID, in.Body.Role)
	if err != nil {
		return interviewerRun{}, storeErr(err)
	}

	plan, err := interviewassign.PlanInterviewers(interviewassign.InterviewerInput{
		Applicants:   applicants,
		Leads:        toInterviewassignLeads(in.Body.Leads),
		Existing:     existing,
		WroteReview:  wroteReview,
		Cap:          in.Body.Cap,
		CapOverrides: in.Body.CapOverrides,
		Seed:         interviewassign.SeedFrom(in.ID, string(in.Body.Role), "interviewer"),
	})
	if err != nil {
		return interviewerRun{}, huma.Error422UnprocessableEntity(err.Error())
	}

	return interviewerRun{plan: plan, prior: existing, byID: byID, appIDs: appIDs}, nil
}

type PreviewInterviewerPlanOutput struct {
	Body InterviewerPlanPreview
}

func (h *interviewAssignmentPlannerHandler) interviewerPreview(ctx context.Context, in *InterviewerPreviewInput) (*PreviewInterviewerPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	run, err := h.buildInterviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}
	body, err := h.decorateInterviewerPlan(ctx, run)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreviewInterviewerPlanOutput{Body: body}, nil
}

type CommitInterviewerPlanOutput struct {
	Body struct {
		Created int                    `json:"created"`
		Plan    InterviewerPlanPreview `json:"plan"`
	}
}

func (h *interviewAssignmentPlannerHandler) interviewerCommit(ctx context.Context, in *InterviewerPreviewInput) (*CommitInterviewerPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	run, err := h.buildInterviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]store.InterviewAssignmentPair, len(run.plan.New))
	for i, p := range run.plan.New {
		pairs[i] = store.InterviewAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}
	created, err := h.store.CreateInterviewAssignments(ctx, pairs, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}

	body, err := h.decorateInterviewerPlan(ctx, run)
	if err != nil {
		return nil, storeErr(err)
	}

	out := &CommitInterviewerPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

func (h *interviewAssignmentPlannerHandler) decorateInterviewerPlan(ctx context.Context, run interviewerRun) (InterviewerPlanPreview, error) {
	names, err := h.leadNames(ctx)
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

func (h *interviewAssignmentPlannerHandler) reviewerPool(ctx context.Context, in *InterviewPoolInput) (*InterviewPoolOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, _, err := h.reviewablePool(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	names, err := h.leadNames(ctx)
	if err != nil {
		return nil, storeErr(err)
	}

	out := &InterviewPoolOutput{}
	out.Body.PoolSize = len(pool)
	out.Body.LeadCount = len(names)
	out.Body.Applicants = toPoolApplicants(pool)
	return out, nil
}

// reviewablePool is the interview-stage applications that already have an
// interviewer assigned, alongside that interviewer's NUID per application.
func (h *interviewAssignmentPlannerHandler) reviewablePool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, map[string]string, error) {
	pool, err := h.interviewPool(ctx, cycleID, role)
	if err != nil {
		return nil, nil, err
	}
	assignments, err := h.store.ListInterviewAssignmentsForCycle(ctx, cycleID, role)
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

// --- reviewer capacity ---

type ReviewerCapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role   `json:"role"`
		Leads                  []PlanLeadDay `json:"leads"`
		Coverage               int           `json:"coverage" minimum:"1"`
		ExcludedApplicationIDs []string      `json:"excluded_application_ids,omitempty"`
	}
}

type ReviewerCapacityOutput struct {
	Body interviewassign.InterviewCapacity
}

func (h *interviewAssignmentPlannerHandler) reviewerCapacity(ctx context.Context, in *ReviewerCapacityInput) (*ReviewerCapacityOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	pool, _, err := h.reviewablePool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return nil, storeErr(err)
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

// --- reviewer preview/commit ---

type ReviewerPreviewInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role                   models.Role    `json:"role"`
		Leads                  []PlanLeadDay  `json:"leads"`
		Coverage               int            `json:"coverage" minimum:"1"`
		Cap                    int            `json:"cap" minimum:"1"`
		CapOverrides           map[string]int `json:"cap_overrides,omitempty"`
		ExcludedApplicationIDs []string       `json:"excluded_application_ids,omitempty"`
	}
}

type reviewerRun struct {
	plan     interviewassign.ReviewerPlan
	prior    []interviewassign.ReviewerPair
	byID     map[string]models.ApplicationSummary
	appIDs   []string
	coverage int
}

func (h *interviewAssignmentPlannerHandler) buildReviewerPlan(ctx context.Context, in *ReviewerPreviewInput) (reviewerRun, error) {
	if !in.Body.Role.Valid() {
		return reviewerRun{}, huma.Error422UnprocessableEntity("role is invalid")
	}
	if len(in.Body.Leads) == 0 {
		return reviewerRun{}, huma.Error422UnprocessableEntity("at least one lead is required")
	}

	pool, interviewerOf, err := h.reviewablePool(ctx, in.ID, in.Body.Role)
	if err != nil {
		return reviewerRun{}, storeErr(err)
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

	existingRows, err := h.store.ListInterviewReviewAssignmentsForCycle(ctx, in.ID, in.Body.Role)
	if err != nil {
		return reviewerRun{}, storeErr(err)
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

// PlannedReviewer is one lead's proposed interview-review queue.
type PlannedReviewer struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	Day          string               `json:"day"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// InterviewReviewPlanPreview is the whole reviewer-stage proposal.
type InterviewReviewPlanPreview struct {
	PoolSize       int                  `json:"pool_size"`
	Coverage       int                  `json:"coverage"`
	Reviewers      []PlannedReviewer    `json:"reviewers"`
	CoverageCounts map[string]int       `json:"coverage_counts"`
	UnderCovered   []PlannedApplication `json:"under_covered"`
	NoDayMatch     []PlannedApplication `json:"no_day_match"`
	Warnings       []string             `json:"warnings"`
	TotalAdded     int                  `json:"total_added"`
}

type PreviewInterviewReviewerPlanOutput struct {
	Body InterviewReviewPlanPreview
}

func (h *interviewAssignmentPlannerHandler) reviewerPreview(ctx context.Context, in *ReviewerPreviewInput) (*PreviewInterviewReviewerPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	run, err := h.buildReviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}
	body, err := h.decorateReviewerPlan(ctx, run)
	if err != nil {
		return nil, storeErr(err)
	}
	return &PreviewInterviewReviewerPlanOutput{Body: body}, nil
}

type CommitInterviewReviewerPlanOutput struct {
	Body struct {
		Created int                        `json:"created"`
		Plan    InterviewReviewPlanPreview `json:"plan"`
	}
}

func (h *interviewAssignmentPlannerHandler) reviewerCommit(ctx context.Context, in *ReviewerPreviewInput) (*CommitInterviewReviewerPlanOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	run, err := h.buildReviewerPlan(ctx, in)
	if err != nil {
		return nil, err
	}

	pairs := make([]store.InterviewReviewAssignmentPair, len(run.plan.New))
	for i, p := range run.plan.New {
		pairs[i] = store.InterviewReviewAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}
	created, err := h.store.CreateInterviewReviewAssignments(ctx, pairs, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}

	body, err := h.decorateReviewerPlan(ctx, run)
	if err != nil {
		return nil, storeErr(err)
	}

	out := &CommitInterviewReviewerPlanOutput{}
	out.Body.Created = created
	out.Body.Plan = body
	return out, nil
}

func (h *interviewAssignmentPlannerHandler) decorateReviewerPlan(ctx context.Context, run reviewerRun) (InterviewReviewPlanPreview, error) {
	names, err := h.leadNames(ctx)
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
func (h *interviewAssignmentPlannerHandler) interviewPool(ctx context.Context, cycleID string, role models.Role) ([]models.ApplicationSummary, error) {
	stage := models.StageInterview
	return h.store.ListApplications(ctx, store.ApplicationFilter{
		CycleID: cycleID,
		Role:    &role,
		Stage:   &stage,
	})
}

// wroteReviewByApplication maps each application to the set of lead NUIDs
// assigned to write its lead review — a lead-assignment row stands in for
// "wrote this applicant's review" (by the interview stage, lead review has
// already happened), so no join to written_reviews is needed.
func (h *interviewAssignmentPlannerHandler) wroteReviewByApplication(ctx context.Context, cycleID string, role models.Role) (map[string]map[string]bool, error) {
	assignments, err := h.store.ListLeadAssignmentsForCycle(ctx, cycleID, role)
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
func (h *interviewAssignmentPlannerHandler) leadNames(ctx context.Context) (map[string]string, error) {
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

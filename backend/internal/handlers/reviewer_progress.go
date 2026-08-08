package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// reviewerProgressHandler exposes, per lead, which applications they're
// assigned to write-review in a cycle and whether each is submitted — the
// per-reviewer breakdown chiefs need to see who still has outstanding
// reviews (as opposed to reviewReleaseHandler's cycle-wide aggregate).
type reviewerProgressHandler struct {
	store *store.Store
}

func (h *reviewerProgressHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-reviewer-progress",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/reviewer-progress",
		Summary:     "Per-reviewer written-review progress for a cycle",
		Description: "Chief only. One entry per lead with any assignment or " +
			"role='lead' account, listing every application assigned to them " +
			"and whether their written review is submitted.",
		Tags:   []string{"Review releases"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.list)
}

type ReviewerProgressInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type ReviewerProgressOutput struct {
	Body []models.ReviewerProgress
}

func (h *reviewerProgressHandler) list(ctx context.Context, in *ReviewerProgressInput) (*ReviewerProgressOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	rows, err := h.store.ListReviewerProgressForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}

	leadRole := models.UserRoleLead
	leads, _, err := h.store.ListUsers(ctx, &leadRole, nil, 0)
	if err != nil {
		return nil, storeErr(err)
	}

	byLead := make(map[string]*models.ReviewerProgress, len(leads))
	order := make([]string, 0, len(leads))
	for _, lead := range leads {
		byLead[lead.NUID] = &models.ReviewerProgress{
			LeadNUID: lead.NUID,
			FullName: lead.FullName,
			Items:    []models.ReviewerProgressItem{},
		}
		order = append(order, lead.NUID)
	}

	for _, r := range rows {
		p, ok := byLead[r.LeadNUID]
		if !ok {
			// An assignment for a lead who no longer holds the lead role: still
			// surface it rather than silently dropping the review.
			p = &models.ReviewerProgress{LeadNUID: r.LeadNUID, Items: []models.ReviewerProgressItem{}}
			byLead[r.LeadNUID] = p
			order = append(order, r.LeadNUID)
		}
		p.Items = append(p.Items, models.ReviewerProgressItem{
			ApplicationID: r.ApplicationID,
			ApplicantNUID: r.ApplicantNUID,
			FullName:      r.FullName,
			Email:         r.Email,
			AssignedAt:    r.AssignedAt,
			SubmittedAt:   r.SubmittedAt,
		})
	}

	out := make([]models.ReviewerProgress, 0, len(order))
	for _, nuid := range order {
		out = append(out, *byLead[nuid])
	}
	return &ReviewerProgressOutput{Body: out}, nil
}

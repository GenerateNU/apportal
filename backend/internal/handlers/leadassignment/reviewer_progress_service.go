package leadassignment

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// reviewerProgressService exposes, per lead, which applications they're
// assigned to write-review in a cycle and whether each is submitted — the
// per-reviewer breakdown chiefs need to see who still has outstanding
// reviews (as opposed to reviewReleaseHandler's cycle-wide aggregate).
type reviewerProgressService struct {
	leadAssignmentDB *LeadAssignmentDB
	userDB           *user.UserDB
}

func (s *reviewerProgressService) list(ctx context.Context, in *ReviewerProgressInput) (*ReviewerProgressOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}

	rows, err := s.leadAssignmentDB.ListReviewerProgressForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	leadRole := models.UserRoleLead
	leads, _, err := s.userDB.ListUsers(ctx, &leadRole, nil, 0)
	if err != nil {
		return nil, utils.StoreErr(err)
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

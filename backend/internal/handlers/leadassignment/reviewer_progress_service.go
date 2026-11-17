package leadassignment

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

// reviewerProgressService exposes, per lead, which applications they're
// assigned to write-review in a cycle and whether each is submitted — the
// per-reviewer breakdown chiefs need to see who still has outstanding
// reviews (as opposed to reviewReleaseHandler's cycle-wide aggregate).
type reviewerProgressService struct {
	access           *access.Checker
	leadAssignmentDB *LeadAssignmentDB
	staffDB          *cyclestaff.CycleStaffDB
}

const maxProgressRoles = 50

func (s *reviewerProgressService) list(ctx context.Context, in *ReviewerProgressInput) (*ReviewerProgressOutput, error) {
	roles := utils.SplitIDs(in.RoleIDs)
	if len(roles) == 0 {
		roles = []string{in.RoleID}
	}
	if len(roles) > maxProgressRoles {
		return nil, huma.Error422UnprocessableEntity("too many role_ids")
	}
	for _, r := range roles {
		if err := role.ParseRoleID(r); err != nil {
			return nil, err
		}
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}

	rows, err := s.leadAssignmentDB.ListReviewerProgressForCycle(ctx, in.ID, roles)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	leads, err := s.staffDB.ListStaff(ctx, in.ID, models.CycleStaffLead)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	byLead := make(map[string]*models.ReviewerProgress, len(leads))
	order := make([]string, 0, len(leads))
	for _, lead := range leads {
		byLead[lead.UserNUID] = &models.ReviewerProgress{
			LeadNUID: lead.UserNUID,
			FullName: lead.FullName,
			Items:    []models.ReviewerProgressItem{},
		}
		order = append(order, lead.UserNUID)
	}

	for _, r := range rows {
		p, ok := byLead[r.LeadNUID]
		if !ok {
			// An assignment for someone no longer a lead on this cycle: still
			// surface it rather than silently dropping the review.
			p = &models.ReviewerProgress{LeadNUID: r.LeadNUID, Items: []models.ReviewerProgressItem{}}
			byLead[r.LeadNUID] = p
			order = append(order, r.LeadNUID)
		}
		p.Items = append(p.Items, models.ReviewerProgressItem{
			ApplicationID: r.ApplicationID,
			RoleID:        r.RoleID,
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

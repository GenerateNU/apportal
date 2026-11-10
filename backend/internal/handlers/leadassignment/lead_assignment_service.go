package leadassignment

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type leadAssignmentService struct {
	applicationDB    *application.ApplicationDB
	leadAssignmentDB *LeadAssignmentDB
}

func (s *leadAssignmentService) create(ctx context.Context, in *CreateLeadAssignmentInput) (*LeadAssignmentOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	a, err := s.leadAssignmentDB.CreateLeadAssignment(ctx, in.ID, in.Body.LeadNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if _, err := s.applicationDB.AdvanceApplicationsToLeadReview(ctx, []string{in.ID}); err != nil {
		return nil, utils.StoreErr(err)
	}
	return &LeadAssignmentOutput{Body: a}, nil
}

func (s *leadAssignmentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*LeadAssignmentsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.leadAssignmentDB.ListLeadAssignments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &LeadAssignmentsOutput{Body: items}, nil
}

func (s *leadAssignmentService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.leadAssignmentDB.DeleteLeadAssignment(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *leadAssignmentService) deleteAll(ctx context.Context, in *DeleteAllLeadAssignmentsInput) (*DeleteAllLeadAssignmentsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := s.leadAssignmentDB.DeleteLeadAssignmentsForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &DeleteAllLeadAssignmentsOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

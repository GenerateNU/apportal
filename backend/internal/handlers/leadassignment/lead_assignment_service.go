package leadassignment

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type leadAssignmentService struct {
	access *access.Checker
	db     *LeadAssignmentDB
	guard  *staffing.Guard
}

func (s *leadAssignmentService) create(ctx context.Context, in *CreateLeadAssignmentInput) (*LeadAssignmentOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	nuid := in.Body.LeadNUID
	if nuid == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	row, err := s.db.Assign(ctx, in.ID, nuid, utils.CurrentActor(ctx).NUID, func(tx *gorm.DB) error {
		return s.guard.CheckAdd(ctx, tx, in.ID, nuid, models.KindReviewer)
	})
	if errors.Is(err, utils.ErrConflict) {
		return nil, huma.Error409Conflict("this reviewer is already assigned to this applicant")
	}
	if err != nil {
		return nil, staffing.HTTPError(err)
	}
	return &LeadAssignmentOutput{Body: row}, nil
}

func (s *leadAssignmentService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*LeadAssignmentsOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	items, err := s.db.ListLeadAssignments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &LeadAssignmentsOutput{Body: items}, nil
}

func (s *leadAssignmentService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireUUIDs("assignment id", in.ID); err != nil {
		return nil, err
	}
	if err := s.access.CanApplicationOf(ctx, access.ManageApplication, "lead_assignments", in.ID); err != nil {
		return nil, err
	}
	err := s.db.Unassign(ctx, in.ID, func(tx *gorm.DB, applicationID string) error {
		return s.guard.CheckRemove(ctx, tx, applicationID, models.KindReviewer)
	})
	if err != nil {
		return nil, staffing.HTTPError(err)
	}
	return nil, nil
}

func (s *leadAssignmentService) deleteAll(ctx context.Context, in *DeleteAllLeadAssignmentsInput) (*DeleteAllLeadAssignmentsOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := utils.RequireUUIDs("cycle id", in.ID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	ok, err := s.db.RoleInCycle(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !ok {
		return nil, huma.Error422UnprocessableEntity("role_id isn't an opening on this cycle")
	}
	deleted, err := s.db.UnassignUnsubmitted(ctx, in.ID, in.RoleID, func(tx *gorm.DB) error {
		return s.guard.CheckOpening(ctx, tx, in.ID, in.RoleID, models.KindReviewer)
	})
	if err != nil {
		return nil, staffing.HTTPError(err)
	}
	out := &DeleteAllLeadAssignmentsOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

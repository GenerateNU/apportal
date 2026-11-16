package assignmentplanner

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/reviewrules"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type reviewService struct {
	gate  cycleGate
	store reviewStore
	rules reviewrules.Rules
}

type CycleIDInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type ConflictsOutput struct {
	Body []reviewrules.Conflict
}

type ConflictInput struct {
	ID            string `path:"id" doc:"Cycle ID"`
	LeadNUID      string `path:"lead_nuid" maxLength:"64" doc:"Lead or chief on this cycle's staff"`
	ApplicantNUID string `path:"applicant_nuid" maxLength:"64" doc:"Someone with an application in this cycle"`
}

func parseCycleID(id string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error422UnprocessableEntity("invalid cycle id")
	}
	return nil
}

func (s *reviewService) manage(ctx context.Context, cycleID string) error {
	if err := access.RequireActor(ctx); err != nil {
		return err
	}
	if err := parseCycleID(cycleID); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}

func (s *reviewService) conflicts(ctx context.Context, in *CycleIDInput) (*ConflictsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	return s.listConflicts(ctx, in.ID)
}

func (s *reviewService) listConflicts(ctx context.Context, cycleID string) (*ConflictsOutput, error) {
	rows, err := s.store.ListConflicts(ctx, cycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ConflictsOutput{Body: rows}, nil
}

func (s *reviewService) addConflict(ctx context.Context, in *ConflictInput) (*ConflictsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	staff, err := s.store.IsStaff(ctx, in.ID, in.LeadNUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !staff {
		return nil, huma.Error422UnprocessableEntity("lead_nuid isn't on this cycle's staff")
	}
	applied, err := s.store.HasApplicant(ctx, in.ID, in.ApplicantNUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !applied {
		return nil, huma.Error404NotFound("no application from applicant_nuid in this cycle")
	}
	if err := s.store.PutConflict(ctx, in.ID, in.LeadNUID, in.ApplicantNUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.listConflicts(ctx, in.ID)
}

func (s *reviewService) removeConflict(ctx context.Context, in *ConflictInput) (*ConflictsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.store.DeleteConflict(ctx, in.ID, in.LeadNUID, in.ApplicantNUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.listConflicts(ctx, in.ID)
}

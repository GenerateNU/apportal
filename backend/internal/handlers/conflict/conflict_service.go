package conflict

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type cycleGate interface {
	CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error
}

type store interface {
	List(ctx context.Context, cycleID string) ([]staffing.Conflict, error)
	Put(ctx context.Context, cycleID, leadNUID, applicantNUID string) error
	Delete(ctx context.Context, cycleID, leadNUID, applicantNUID string) error
	IsStaff(ctx context.Context, cycleID, nuid string) (bool, error)
	HasApplicant(ctx context.Context, cycleID, nuid string) (bool, error)
}

type service struct {
	gate  cycleGate
	store store
}

type ConflictsOutput struct {
	Body []staffing.Conflict
}

type ConflictInput struct {
	ID            string `path:"id" doc:"Cycle ID"`
	LeadNUID      string `path:"lead_nuid" maxLength:"64" doc:"Lead or chief on this cycle's staff"`
	ApplicantNUID string `path:"applicant_nuid" maxLength:"64" doc:"Someone with an application in this cycle"`
}

func (s *service) manage(ctx context.Context, cycleID string) error {
	if err := access.RequireActor(ctx); err != nil {
		return err
	}
	if err := utils.RequireUUIDs("cycle id", cycleID); err != nil {
		return err
	}
	return s.gate.CanCycle(ctx, access.ManageCycle, cycleID)
}

func (s *service) listed(ctx context.Context, cycleID string) (*ConflictsOutput, error) {
	rows, err := s.store.List(ctx, cycleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ConflictsOutput{Body: rows}, nil
}

func (s *service) list(ctx context.Context, in *utils.CycleScopedInput) (*ConflictsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	return s.listed(ctx, in.ID)
}

func (s *service) add(ctx context.Context, in *ConflictInput) (*ConflictsOutput, error) {
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
	if err := s.store.Put(ctx, in.ID, in.LeadNUID, in.ApplicantNUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.listed(ctx, in.ID)
}

func (s *service) remove(ctx context.Context, in *ConflictInput) (*ConflictsOutput, error) {
	if err := s.manage(ctx, in.ID); err != nil {
		return nil, err
	}
	if err := s.store.Delete(ctx, in.ID, in.LeadNUID, in.ApplicantNUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.listed(ctx, in.ID)
}

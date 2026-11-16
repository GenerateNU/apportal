package reviewrelease

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

// reviewReleaseService exposes the blind-review gate: per-cycle progress for
// each review kind and a chief-only toggle to release (or hide) them for all
// reviewers at once.
type reviewReleaseService struct {
	access          *access.Checker
	reviewReleaseDB *ReviewReleaseDB
	roleDB          *role.RoleDB
}

func (s *reviewReleaseService) list(ctx context.Context, in *utils.CycleScopedInput) (*ReviewGatesOutput, error) {
	if err := s.access.CanCycle(ctx, access.ReviewCycle, in.ID); err != nil {
		return nil, err
	}
	roles, err := s.roleDB.ListCycleRoles(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	ids := make([]string, len(roles))
	for i, r := range roles {
		ids[i] = r.ID
	}
	gates, err := s.reviewReleaseDB.ReviewGates(ctx, in.ID, ids, []models.ReviewKind{models.ReviewKindWritten, models.ReviewKindRecording})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewGatesOutput{Body: gates}, nil
}

func (s *reviewReleaseService) set(ctx context.Context, in *SetReviewReleaseInput) (*ReviewGateOutput, error) {
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.Body.RoleID); err != nil {
		return nil, err
	}
	if !in.Body.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("kind must be 'written' or 'recording'")
	}
	gate, err := s.reviewReleaseDB.SetReviewRelease(ctx, in.ID, in.Body.RoleID, in.Body.Kind, in.Body.Released, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewGateOutput{Body: gate}, nil
}

package reviewrelease

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// reviewReleaseService exposes the blind-review gate: per-cycle progress for
// each review kind and a chief-only toggle to release (or hide) them for all
// reviewers at once.
type reviewReleaseService struct {
	reviewReleaseDB *ReviewReleaseDB
	roleDB          *role.RoleDB
}

func (s *reviewReleaseService) list(ctx context.Context, in *utils.CycleScopedInput) (*ReviewGatesOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	roles, err := s.roleDB.ListCycleRoles(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	kinds := []models.ReviewKind{models.ReviewKindWritten, models.ReviewKindRecording}
	gates := make([]models.ReviewGate, 0, len(roles)*len(kinds))
	for _, r := range roles {
		for _, kind := range kinds {
			gate, err := s.reviewReleaseDB.ReviewGate(ctx, in.ID, r.ID, kind)
			if err != nil {
				return nil, utils.StoreErr(err)
			}
			gates = append(gates, gate)
		}
	}
	return &ReviewGatesOutput{Body: gates}, nil
}

func (s *reviewReleaseService) set(ctx context.Context, in *SetReviewReleaseInput) (*ReviewGateOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
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

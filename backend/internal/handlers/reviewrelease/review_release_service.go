package reviewrelease

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// reviewReleaseService exposes the blind-review gate: per-cycle progress for
// each review kind and a chief-only toggle to release (or hide) them for all
// reviewers at once.
type reviewReleaseService struct {
	reviewReleaseDB *ReviewReleaseDB
}

func (s *reviewReleaseService) list(ctx context.Context, in *utils.CycleScopedInput) (*ReviewGatesOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	roles := []models.Role{models.RoleSoftwareEngineer, models.RoleSoftwareDesigner}
	kinds := []models.ReviewKind{models.ReviewKindWritten, models.ReviewKindRecording}
	gates := make([]models.ReviewGate, 0, len(roles)*len(kinds))
	for _, role := range roles {
		for _, kind := range kinds {
			gate, err := s.reviewReleaseDB.ReviewGate(ctx, in.ID, role, kind)
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
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	if !in.Body.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("kind must be 'written' or 'recording'")
	}
	gate, err := s.reviewReleaseDB.SetReviewRelease(ctx, in.ID, in.Body.Role, in.Body.Kind, in.Body.Released, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ReviewGateOutput{Body: gate}, nil
}

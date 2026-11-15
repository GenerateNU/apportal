package reviewranking

import (
	"context"
	"math"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type rankingService struct {
	access    *access.Checker
	rankingDB *RankingDB
	roleDB    *role.RoleDB
}

func (s *rankingService) get(ctx context.Context, in *RankingInput) (*RankingOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	apps, err := s.rankingDB.ListApplications(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	scores, err := s.rankingDB.ListScores(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	overrides, err := s.rankingDB.ListOverrides(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	cutoff, err := s.rankingDB.GetCutoff(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RankingOutput{Body: models.ReviewRanking{
		Cutoff:  cutoff,
		Entries: Rank(apps, scores, cutoff, overrides),
	}}, nil
}

func validateCutoff(mode models.CutoffMode, value float64) error {
	if !mode.Valid() {
		return huma.Error422UnprocessableEntity("mode must be min_score or top_n")
	}
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return huma.Error422UnprocessableEntity("value must be a finite number")
	}
	if mode == models.CutoffTopN && (value < 0 || value != math.Trunc(value)) {
		return huma.Error422UnprocessableEntity("top_n value must be a non-negative whole number")
	}
	return nil
}

func (s *rankingService) putCutoff(ctx context.Context, in *PutCutoffInput) (*CutoffOutput, error) {
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.Body.RoleID); err != nil {
		return nil, err
	}
	if err := validateCutoff(in.Body.Mode, in.Body.Value); err != nil {
		return nil, err
	}
	c, err := s.rankingDB.UpsertCutoff(ctx, models.ReviewCutoff{
		CycleID:   in.ID,
		RoleID:    in.Body.RoleID,
		Mode:      in.Body.Mode,
		Value:     in.Body.Value,
		UpdatedBy: utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CutoffOutput{Body: c}, nil
}

func (s *rankingService) deleteCutoff(ctx context.Context, in *DeleteCutoffInput) (*struct{}, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	if err := s.rankingDB.DeleteCutoff(ctx, in.ID, in.RoleID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *rankingService) putOverride(ctx context.Context, in *PutOverrideInput) (*OverrideOutput, error) {
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	o, err := s.rankingDB.UpsertOverride(ctx, models.ReviewCutoffOverride{
		ApplicationID: in.ID,
		Included:      in.Body.Included,
		SetBy:         utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &OverrideOutput{Body: o}, nil
}

func (s *rankingService) deleteOverride(ctx context.Context, in *utils.ApplicationScopedInput) (*struct{}, error) {
	if err := s.access.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	if err := s.rankingDB.DeleteOverride(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

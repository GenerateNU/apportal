package reviewranking

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type authorizer interface {
	Cycle(ctx context.Context, cycleID string) (access.CycleAccess, error)
	Application(ctx context.Context, applicationID string) (access.ApplicationAccess, error)
}

type rankingStore interface {
	ListApplications(ctx context.Context, cycleID, roleID string) ([]AppRow, error)
	ListScores(ctx context.Context, cycleID, roleID string) ([]ScoreRow, error)
	ListOverrides(ctx context.Context, cycleID, roleID string) (map[string]bool, error)
	GetCutoff(ctx context.Context, cycleID, roleID string) (*models.ReviewCutoff, error)
	UpsertCutoff(ctx context.Context, c models.ReviewCutoff) (models.ReviewCutoff, error)
	DeleteCutoff(ctx context.Context, cycleID, roleID string) error
	ApplicationOpening(ctx context.Context, applicationID string) (cycleID, roleID string, err error)
	UpsertOverride(ctx context.Context, o models.ReviewCutoffOverride) (models.ReviewCutoffOverride, error)
	DeleteOverride(ctx context.Context, applicationID string) error
	DeleteOverrides(ctx context.Context, cycleID, roleID string) error
}

type cycleRoles interface {
	CycleHasRole(ctx context.Context, cycleID, roleID string) (bool, error)
}

type rankingService struct {
	access authorizer
	store  rankingStore
	roles  cycleRoles
	rules  ShortlistRules
}

const reviewsPending = "Reviews for this opening aren't in yet. The shortlist unlocks once every assigned review is submitted or the review due date passes."

func parseID(id, name string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error422UnprocessableEntity("invalid " + name)
	}
	return nil
}

// manageOpening checks the caller runs this cycle and that roleID is one of its roles.
func (s *rankingService) manageOpening(ctx context.Context, cycleID, roleID string) error {
	if err := parseID(cycleID, "cycle id"); err != nil {
		return err
	}
	if err := role.ParseRoleID(roleID); err != nil {
		return err
	}
	a, err := s.access.Cycle(ctx, cycleID)
	if err != nil {
		return err
	}
	if err := a.Can(access.ManageCycle); err != nil {
		return err
	}
	ok, err := s.roles.CycleHasRole(ctx, cycleID, roleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if !ok {
		return huma.Error422UnprocessableEntity("role_id is not a role in this cycle")
	}
	return nil
}

func (s *rankingService) requireReviewsIn(ctx context.Context, cycleID, roleID string) error {
	in, err := s.rules.ReviewsIn(ctx, cycleID, roleID)
	if err != nil {
		return utils.StoreErr(err)
	}
	if !in {
		return huma.Error409Conflict(reviewsPending)
	}
	return nil
}

// manageApplication returns the opening of an application the caller runs.
func (s *rankingService) manageApplication(ctx context.Context, applicationID string) (string, string, error) {
	if err := parseID(applicationID, "application id"); err != nil {
		return "", "", err
	}
	a, err := s.access.Application(ctx, applicationID)
	if err != nil {
		return "", "", err
	}
	if err := a.Can(access.ManageApplication); err != nil {
		return "", "", err
	}
	cycleID, roleID, err := s.store.ApplicationOpening(ctx, applicationID)
	if err != nil {
		return "", "", utils.StoreErr(err)
	}
	return cycleID, roleID, nil
}

func (s *rankingService) ranking(ctx context.Context, cycleID, roleID string) (models.ReviewRanking, error) {
	apps, err := s.store.ListApplications(ctx, cycleID, roleID)
	if err != nil {
		return models.ReviewRanking{}, utils.StoreErr(err)
	}
	scores, err := s.store.ListScores(ctx, cycleID, roleID)
	if err != nil {
		return models.ReviewRanking{}, utils.StoreErr(err)
	}
	overrides, err := s.store.ListOverrides(ctx, cycleID, roleID)
	if err != nil {
		return models.ReviewRanking{}, utils.StoreErr(err)
	}
	cutoff, err := s.store.GetCutoff(ctx, cycleID, roleID)
	if err != nil {
		return models.ReviewRanking{}, utils.StoreErr(err)
	}
	in, err := s.rules.ReviewsIn(ctx, cycleID, roleID)
	if err != nil {
		return models.ReviewRanking{}, utils.StoreErr(err)
	}
	return models.ReviewRanking{Cutoff: cutoff, ReviewsIn: in, Entries: Rank(apps, scores, cutoff, overrides)}, nil
}

func (s *rankingService) get(ctx context.Context, in *OpeningInput) (*RankingOutput, error) {
	if err := s.manageOpening(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	r, err := s.ranking(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, err
	}
	return &RankingOutput{Body: r}, nil
}

func validateCutoff(mode models.CutoffMode, value float64) error {
	if !mode.Valid() {
		return huma.Error422UnprocessableEntity("mode must be min_score or top_n")
	}
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return huma.Error422UnprocessableEntity("value must be a finite number")
	}
	if mode == models.CutoffTopN && (value < 0 || value != math.Trunc(value) || value > math.MaxInt32) {
		return huma.Error422UnprocessableEntity("top_n value must be a whole number of at least 0")
	}
	return nil
}

func (s *rankingService) putCutoff(ctx context.Context, in *PutCutoffInput) (*CutoffOutput, error) {
	if err := validateCutoff(in.Body.Mode, in.Body.Value); err != nil {
		return nil, err
	}
	if err := s.manageOpening(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := s.requireReviewsIn(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	c, err := s.store.UpsertCutoff(ctx, models.ReviewCutoff{
		CycleID:   in.ID,
		RoleID:    in.RoleID,
		Mode:      in.Body.Mode,
		Value:     in.Body.Value,
		UpdatedBy: utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &CutoffOutput{Body: c}, nil
}

func (s *rankingService) deleteCutoff(ctx context.Context, in *OpeningInput) (*struct{}, error) {
	if err := s.manageOpening(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := s.requireReviewsIn(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := s.store.DeleteCutoff(ctx, in.ID, in.RoleID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *rankingService) putOverride(ctx context.Context, in *PutOverrideInput) (*OverrideOutput, error) {
	cycleID, roleID, err := s.manageApplication(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := s.requireReviewsIn(ctx, cycleID, roleID); err != nil {
		return nil, err
	}
	o, err := s.store.UpsertOverride(ctx, models.ReviewCutoffOverride{
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
	cycleID, roleID, err := s.manageApplication(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := s.requireReviewsIn(ctx, cycleID, roleID); err != nil {
		return nil, err
	}
	if err := s.store.DeleteOverride(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *rankingService) deleteOverrides(ctx context.Context, in *OpeningInput) (*struct{}, error) {
	if err := s.manageOpening(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := s.requireReviewsIn(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	if err := s.store.DeleteOverrides(ctx, in.ID, in.RoleID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *rankingService) advance(ctx context.Context, in *AdvanceInput) (*AdvanceOutput, error) {
	requested := in.applicationIDs()
	if len(requested) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity(fmt.Sprintf("at most %d application_ids", utils.MaxBulkApplications))
	}
	for _, id := range requested {
		if err := parseID(id, "application id "+id); err != nil {
			return nil, err
		}
	}
	if err := s.manageOpening(ctx, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	r, err := s.ranking(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, err
	}
	if !r.ReviewsIn {
		return nil, huma.Error409Conflict(reviewsPending)
	}
	ids, err := shortlisted(r.Entries, requested)
	if err != nil {
		return nil, err
	}
	moved, err := s.rules.Advance(ctx, in.ID, in.RoleID, ids, utils.CurrentActor(ctx).NUID)
	if errors.Is(err, ErrNoNextStage) {
		return nil, huma.Error409Conflict("This cycle has no enabled stage after review to move the shortlist into.")
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &AdvanceOutput{}
	out.Body.Moved = append([]string{}, moved...)
	return out, nil
}

// shortlisted is everyone included, or the requested ids after checking each is included.
func shortlisted(entries []models.ReviewRankingEntry, requested []string) ([]string, error) {
	included := map[string]bool{}
	all := []string{}
	for _, e := range entries {
		if e.Included {
			included[e.ApplicationID] = true
			all = append(all, e.ApplicationID)
		}
	}
	if len(requested) == 0 {
		return all, nil
	}
	ids := make([]string, 0, len(requested))
	seen := map[string]bool{}
	for _, id := range requested {
		if !included[id] {
			return nil, huma.Error422UnprocessableEntity("application " + id + " is not on this opening's shortlist")
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids, nil
}

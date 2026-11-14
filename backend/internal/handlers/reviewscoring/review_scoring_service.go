package reviewscoring

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/reviewscore"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type reviewScoringService struct {
	db *ReviewScoringDB
}

func checkCycleID(id string) error {
	if _, err := uuid.Parse(id); err != nil {
		return huma.Error404NotFound("cycle not found")
	}
	return nil
}

func (s *reviewScoringService) getRubric(ctx context.Context, in *utils.CycleScopedInput) (*RubricOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if err := checkCycleID(in.ID); err != nil {
		return nil, err
	}
	rubric, err := s.db.GetRubric(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RubricOutput{Body: rubric}, nil
}

func validateRubric(in *UpdateRubricInput) (RubricWrite, error) {
	b := in.Body
	if !b.Rubric.Valid() {
		return RubricWrite{}, huma.Error422UnprocessableEntity("rubric must be score or category")
	}
	if b.ScoreMin >= b.ScoreMax {
		return RubricWrite{}, huma.Error422UnprocessableEntity("score_min must be below score_max")
	}
	seen := map[string]bool{}
	cats := make([]CategoryBody, 0, len(b.Categories))
	points := map[int]bool{}
	for _, c := range b.Categories {
		label := strings.TrimSpace(c.Label)
		if label == "" {
			return RubricWrite{}, huma.Error422UnprocessableEntity("every category needs a label")
		}
		if seen[strings.ToLower(label)] {
			return RubricWrite{}, huma.Error422UnprocessableEntity("category labels must be unique: " + label)
		}
		seen[strings.ToLower(label)] = true
		points[c.Points] = true
		cats = append(cats, CategoryBody{Label: label, Points: c.Points})
	}
	if b.Rubric == models.RubricCategory && (len(cats) < 2 || len(points) < 2) {
		return RubricWrite{}, huma.Error422UnprocessableEntity("a category rubric needs at least two categories with different points")
	}
	return RubricWrite{Rubric: b.Rubric, ScoreMin: b.ScoreMin, ScoreMax: b.ScoreMax, Categories: cats}, nil
}

func (s *reviewScoringService) putRubric(ctx context.Context, in *UpdateRubricInput) (*RubricOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := checkCycleID(in.ID); err != nil {
		return nil, err
	}
	w, err := validateRubric(in)
	if err != nil {
		return nil, err
	}
	rubric, err := s.db.ReplaceRubric(ctx, in.ID, w)
	if errors.Is(err, utils.ErrConflict) {
		return nil, huma.Error409Conflict("leads have already rated answers this cycle, so the rubric can't change")
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RubricOutput{Body: rubric}, nil
}

func (s *reviewScoringService) getSettings(ctx context.Context, in *RoleQueryInput) (*SettingsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := checkCycleID(in.ID); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	if err := s.db.CycleExists(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	settings, err := s.db.GetSettings(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SettingsOutput{Body: settings}, nil
}

func (s *reviewScoringService) putSettings(ctx context.Context, in *UpdateSettingsInput) (*SettingsOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := checkCycleID(in.ID); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	if c := in.Body.Cutoff; c != nil && (math.IsNaN(*c) || math.IsInf(*c, 0)) {
		return nil, huma.Error422UnprocessableEntity("cutoff must be a number")
	}
	if err := s.db.CycleExists(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	actor := utils.CurrentActor(ctx).NUID
	settings, err := s.db.PutSettings(ctx, models.ReviewScoringSetting{
		CycleID:   in.ID,
		Role:      in.Body.Role,
		Normalize: in.Body.Normalize,
		Cutoff:    in.Body.Cutoff,
		UpdatedBy: &actor,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &SettingsOutput{Body: settings}, nil
}

func categoryRange(cats []models.ReviewRubricCategory) (float64, float64) {
	if len(cats) == 0 {
		return 0, 0
	}
	lo, hi := math.Inf(1), math.Inf(-1)
	for _, c := range cats {
		lo = math.Min(lo, float64(c.Points))
		hi = math.Max(hi, float64(c.Points))
	}
	return lo, hi
}

func (s *reviewScoringService) scores(ctx context.Context, in *RoleQueryInput) (*ScoresOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := checkCycleID(in.ID); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	rubric, err := s.db.GetRubric(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	settings, err := s.db.GetSettings(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	rows, err := s.db.Ratings(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	scoreLo, scoreHi := float64(rubric.ScoreMin), float64(rubric.ScoreMax)
	catLo, catHi := categoryRange(rubric.Categories)
	ratings := make([]reviewscore.Rating, 0, len(rows))
	for _, r := range rows {
		var value float64
		switch {
		case r.Score != nil:
			value = reviewscore.Scale(float64(*r.Score), scoreLo, scoreHi)
		case r.Points != nil:
			value = reviewscore.Scale(float64(*r.Points), catLo, catHi)
		default:
			continue
		}
		ratings = append(ratings, reviewscore.Rating{
			ApplicationID: r.ApplicationID, ReviewerNUID: r.ReviewerNUID, Value: value, Weight: r.Weight,
		})
	}

	lo, hi := scoreLo, scoreHi
	if rubric.Rubric == models.RubricCategory && catHi > catLo {
		lo, hi = catLo, catHi
	}

	out := &ScoresOutput{}
	out.Body.Min, out.Body.Max = lo, hi
	out.Body.Normalize = settings.Normalize
	out.Body.Cutoff = settings.Cutoff
	out.Body.Scores = []ApplicationScore{}
	for _, sc := range reviewscore.Compute(ratings) {
		item := ApplicationScore{
			ApplicationID: sc.ApplicationID,
			Raw:           round2(reviewscore.Unscale(sc.Raw, lo, hi)),
			Normalized:    round2(reviewscore.Unscale(sc.Normalized, lo, hi)),
			Reviews:       sc.Reviews,
		}
		item.Score = item.Raw
		if settings.Normalize {
			item.Score = item.Normalized
		}
		if settings.Cutoff != nil {
			above := item.Score >= *settings.Cutoff
			item.AboveCutoff = &above
		}
		out.Body.Scores = append(out.Body.Scores, item)
	}
	sort.SliceStable(out.Body.Scores, func(i, j int) bool {
		return out.Body.Scores[i].Score > out.Body.Scores[j].Score
	})
	return out, nil
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

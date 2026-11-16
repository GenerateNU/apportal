package staffing

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type InterviewRules interface {
	PerApplicant(ctx context.Context, cycleID string, kind models.StaffKind) (int, error)
	Released(ctx context.Context, cycleID, roleID string) (bool, error)
}

type Conflicts interface {
	Conflicted(ctx context.Context, cycleID string, applicantNUIDs []string) (map[string]map[string]bool, error)
}

type NoConflicts struct{}

func (NoConflicts) Conflicted(context.Context, string, []string) (map[string]map[string]bool, error) {
	return map[string]map[string]bool{}, nil
}

const (
	DefaultReviewers          = 2
	DefaultInterviewers       = 2
	DefaultRecordingReviewers = 1
)

type StageRules struct {
	db *gorm.DB
}

func NewStageRules(db *gorm.DB) StageRules {
	return StageRules{db: db}
}

type stageSetting struct {
	Found    bool
	Active   bool
	Required int
}

var kindStage = map[models.StaffKind]models.ApplicationStage{
	models.KindReviewer:          models.StageLeadReview,
	models.KindInterviewer:       models.StageInterview,
	models.KindRecordingReviewer: models.StageInterviewReview,
}

func (r StageRules) PerApplicant(ctx context.Context, cycleID string, kind models.StaffKind) (int, error) {
	var rows []models.CycleStage
	err := r.db.WithContext(ctx).Where("cycle_id = ? AND stage = ?", cycleID, kindStage[kind]).Limit(1).Find(&rows).Error
	if err != nil {
		return 0, err
	}
	s := stageSetting{}
	if len(rows) > 0 {
		s = stageSetting{Found: true, Active: rows[0].IsActive, Required: rows[0].RequiredAssignments}
	}
	return perApplicant(kind, s), nil
}

// Recording reviews are opt-in: no active interview_review stage means none.
func perApplicant(kind models.StaffKind, s stageSetting) int {
	switch kind {
	case models.KindRecordingReviewer:
		if !s.Found || !s.Active {
			return 0
		}
		return orDefault(s.Required, DefaultRecordingReviewers)
	case models.KindInterviewer:
		return orDefault(s.Required, DefaultInterviewers)
	default:
		return orDefault(s.Required, DefaultReviewers)
	}
}

func orDefault(n, def int) int {
	if n > 0 {
		return n
	}
	return def
}

// Released is always false: main has no interview release yet.
func (StageRules) Released(context.Context, string, string) (bool, error) {
	return false, nil
}

func Limits(ctx context.Context, r InterviewRules, cycleID string) (map[models.StaffKind]int, error) {
	out := make(map[models.StaffKind]int, len(models.StaffKinds))
	for _, k := range models.StaffKinds {
		n, err := r.PerApplicant(ctx, cycleID, k)
		if err != nil {
			return nil, err
		}
		out[k] = n
	}
	return out, nil
}

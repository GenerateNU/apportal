package reviewranking

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type RankingDB struct {
	db *gorm.DB
}

func NewRankingDB(db *gorm.DB) *RankingDB {
	return &RankingDB{db: db}
}

func (r *RankingDB) ListApplications(ctx context.Context, cycleID, roleID string) ([]AppRow, error) {
	rows := []AppRow{}
	err := applicationsQuery(r.db.WithContext(ctx), cycleID, roleID).Scan(&rows).Error
	return rows, err
}

func applicationsQuery(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	return db.Model(&models.Application{}).
		Select("id, stage").
		Where("cycle_id = ? AND role_id = ? AND stage NOT IN ?", cycleID, roleID,
			[]models.ApplicationStage{models.StageDraft, models.StageWithdrawn}).
		Order("id")
}

func (r *RankingDB) ListScores(ctx context.Context, cycleID, roleID string) ([]ScoreRow, error) {
	rows := []ScoreRow{}
	err := scoresQuery(r.db.WithContext(ctx), cycleID, roleID).Scan(&rows).Error
	return rows, err
}

func scoresQuery(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	return db.Table("written_review_answers wra").
		Select("wr.application_id, wr.reviewer_nuid, wra.review_question_id, wra.score, rq.score_min, rq.score_max, rq.ranked").
		Joins("JOIN written_reviews wr ON wr.id = wra.review_id").
		Joins("JOIN applications a ON a.id = wr.application_id").
		Joins("JOIN review_questions rq ON rq.id = wra.review_question_id").
		Where("a.cycle_id = ? AND a.role_id = ? AND wr.submitted_at IS NOT NULL AND wra.score IS NOT NULL AND rq.question_type = ? AND rq.ranked",
			cycleID, roleID, models.QuestionScore).
		Order("wr.application_id").Order("wr.reviewer_nuid").Order("wra.review_question_id")
}

func (r *RankingDB) ListOverrides(ctx context.Context, cycleID, roleID string) (map[string]bool, error) {
	var rows []models.ReviewCutoffOverride
	err := r.db.WithContext(ctx).Table("review_cutoff_overrides o").
		Select("o.*").
		Joins("JOIN applications a ON a.id = o.application_id").
		Where("a.cycle_id = ? AND a.role_id = ?", cycleID, roleID).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(rows))
	for _, o := range rows {
		out[o.ApplicationID] = o.Included
	}
	return out, nil
}

func (r *RankingDB) GetCutoff(ctx context.Context, cycleID, roleID string) (*models.ReviewCutoff, error) {
	var c models.ReviewCutoff
	err := r.db.WithContext(ctx).Where("cycle_id = ? AND role_id = ?", cycleID, roleID).Take(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *RankingDB) UpsertCutoff(ctx context.Context, c models.ReviewCutoff) (models.ReviewCutoff, error) {
	err := r.db.WithContext(ctx).Select("cycle_id", "role_id", "mode", "value", "updated_by").
		Clauses(
			clause.OnConflict{
				Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "role_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"mode", "value", "updated_by"}),
			},
			clause.Returning{},
		).
		Create(&c).Error
	return c, utils.DBErr(err)
}

func (r *RankingDB) DeleteCutoff(ctx context.Context, cycleID, roleID string) error {
	return r.db.WithContext(ctx).Where("cycle_id = ? AND role_id = ?", cycleID, roleID).Delete(&models.ReviewCutoff{}).Error
}

// ApplicationOpening is the cycle and role an application belongs to.
func (r *RankingDB) ApplicationOpening(ctx context.Context, applicationID string) (cycleID, roleID string, err error) {
	var a models.Application
	err = r.db.WithContext(ctx).Select("cycle_id", "role_id").Where("id = ?", applicationID).Take(&a).Error
	return a.CycleID, a.RoleID, utils.DBErr(err)
}

func (r *RankingDB) UpsertOverride(ctx context.Context, o models.ReviewCutoffOverride) (models.ReviewCutoffOverride, error) {
	err := r.db.WithContext(ctx).Select("application_id", "included", "set_by").
		Clauses(
			clause.OnConflict{
				Columns:   []clause.Column{{Name: "application_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"included", "set_by"}),
			},
			clause.Returning{},
		).
		Create(&o).Error
	return o, utils.DBErr(err)
}

func (r *RankingDB) DeleteOverride(ctx context.Context, applicationID string) error {
	return r.db.WithContext(ctx).Where("application_id = ?", applicationID).Delete(&models.ReviewCutoffOverride{}).Error
}

func (r *RankingDB) DeleteOverrides(ctx context.Context, cycleID, roleID string) error {
	return deleteOverridesQuery(r.db.WithContext(ctx), cycleID, roleID).Delete(&models.ReviewCutoffOverride{}).Error
}

func deleteOverridesQuery(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	apps := db.Session(&gorm.Session{NewDB: true}).Model(&models.Application{}).Select("id").Where("cycle_id = ? AND role_id = ?", cycleID, roleID)
	return db.Where("application_id IN (?)", apps)
}

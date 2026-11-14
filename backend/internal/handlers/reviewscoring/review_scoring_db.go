package reviewscoring

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ReviewScoringDB struct {
	db *gorm.DB
}

func NewReviewScoringDB(db *gorm.DB) *ReviewScoringDB {
	return &ReviewScoringDB{db: db}
}

func rubricLocked(tx *gorm.DB, cycleID string) (bool, error) {
	var locked bool
	err := tx.Raw(`SELECT EXISTS (
		SELECT 1 FROM written_review_answers wra
		JOIN review_questions rq ON rq.id = wra.review_question_id
		WHERE rq.cycle_id = ? AND (wra.score IS NOT NULL OR wra.category_id IS NOT NULL))`, cycleID).Scan(&locked).Error
	return locked, err
}

func categories(tx *gorm.DB, cycleID string) ([]models.ReviewRubricCategory, error) {
	out := []models.ReviewRubricCategory{}
	err := tx.Where("cycle_id = ?", cycleID).Order("display_order").Order("points DESC").Find(&out).Error
	return out, err
}

func (d *ReviewScoringDB) GetRubric(ctx context.Context, cycleID string) (Rubric, error) {
	return getRubric(d.db.WithContext(ctx), cycleID)
}

func getRubric(tx *gorm.DB, cycleID string) (Rubric, error) {
	var cycle models.Cycle
	if err := tx.Where("id = ?", cycleID).Take(&cycle).Error; err != nil {
		return Rubric{}, utils.DBErr(err)
	}
	cats, err := categories(tx, cycleID)
	if err != nil {
		return Rubric{}, err
	}
	locked, err := rubricLocked(tx, cycleID)
	if err != nil {
		return Rubric{}, err
	}
	return Rubric{
		Rubric:     cycle.ReviewRubric,
		ScoreMin:   cycle.ReviewScoreMin,
		ScoreMax:   cycle.ReviewScoreMax,
		Categories: cats,
		Locked:     locked,
	}, nil
}

func (d *ReviewScoringDB) ReplaceRubric(ctx context.Context, cycleID string, in RubricWrite) (Rubric, error) {
	var out Rubric
	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var cycle models.Cycle
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", cycleID).Take(&cycle).Error; err != nil {
			return err
		}
		locked, err := rubricLocked(tx, cycleID)
		if err != nil {
			return err
		}
		if locked {
			return utils.ErrConflict
		}
		err = tx.Model(&models.Cycle{}).Where("id = ?", cycleID).UpdateColumns(map[string]any{
			"review_rubric":    in.Rubric,
			"review_score_min": in.ScoreMin,
			"review_score_max": in.ScoreMax,
		}).Error
		if err != nil {
			return err
		}
		if err := tx.Where("cycle_id = ?", cycleID).Delete(&models.ReviewRubricCategory{}).Error; err != nil {
			return err
		}
		if len(in.Categories) > 0 {
			rows := make([]models.ReviewRubricCategory, len(in.Categories))
			for n, c := range in.Categories {
				rows[n] = models.ReviewRubricCategory{CycleID: cycleID, Label: c.Label, Points: c.Points, DisplayOrder: n}
			}
			if err := tx.Select("cycle_id", "label", "points", "display_order").Create(&rows).Error; err != nil {
				return err
			}
		}
		out, err = getRubric(tx, cycleID)
		return err
	})
	return out, utils.DBErr(err)
}

func (d *ReviewScoringDB) GetSettings(ctx context.Context, cycleID string, role models.Role) (models.ReviewScoringSetting, error) {
	var rows []models.ReviewScoringSetting
	err := d.db.WithContext(ctx).Where("cycle_id = ? AND application_role = ?", cycleID, role).Limit(1).Find(&rows).Error
	if err != nil {
		return models.ReviewScoringSetting{}, err
	}
	if len(rows) == 0 {
		return models.ReviewScoringSetting{CycleID: cycleID, Role: role}, nil
	}
	return rows[0], nil
}

func (d *ReviewScoringDB) PutSettings(ctx context.Context, in models.ReviewScoringSetting) (models.ReviewScoringSetting, error) {
	err := d.db.WithContext(ctx).
		Select("cycle_id", "application_role", "normalize", "cutoff", "updated_by").
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "cycle_id"}, {Name: "application_role"}},
			DoUpdates: clause.AssignmentColumns([]string{"normalize", "cutoff", "updated_by"}),
		}, clause.Returning{}).
		Create(&in).Error
	return in, utils.DBErr(err)
}

func (d *ReviewScoringDB) Ratings(ctx context.Context, cycleID string, role models.Role) ([]ratingRow, error) {
	rows := []ratingRow{}
	err := d.db.WithContext(ctx).Table("written_review_answers wra").
		Select("a.id AS application_id, wr.reviewer_nuid, rq.weight::float8 AS weight, wra.score, rc.points").
		Joins("JOIN written_reviews wr ON wr.id = wra.review_id AND wr.submitted_at IS NOT NULL").
		Joins("JOIN applications a ON a.id = wr.application_id").
		Joins("JOIN review_questions rq ON rq.id = wra.review_question_id AND rq.question_type = ?", models.QuestionScore).
		Joins("LEFT JOIN review_rubric_categories rc ON rc.id = wra.category_id").
		Where("a.cycle_id = ? AND a.application_role = ?", cycleID, role).
		Where("wra.score IS NOT NULL OR wra.category_id IS NOT NULL").
		Scan(&rows).Error
	return rows, err
}

func (d *ReviewScoringDB) CycleExists(ctx context.Context, cycleID string) error {
	var n int64
	if err := d.db.WithContext(ctx).Model(&models.Cycle{}).Where("id = ?", cycleID).Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return utils.ErrNotFound
	}
	return nil
}

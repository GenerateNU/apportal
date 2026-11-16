package reviewquestion

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ReviewQuestionDB struct {
	db *gorm.DB
}

func NewReviewQuestionDB(db *gorm.DB) *ReviewQuestionDB {
	return &ReviewQuestionDB{db: db}
}

func (r *ReviewQuestionDB) CreateReviewQuestion(ctx context.Context, in ReviewQuestionCreate) (models.ReviewQuestion, error) {
	question := models.ReviewQuestion{
		CycleID:      in.CycleID,
		RoleID:       in.RoleID,
		QuestionText: in.QuestionText,
		QuestionType: in.QuestionType,
		IsRequired:   in.IsRequired,
		DisplayOrder: in.DisplayOrder,
		Options:      in.Options,
		Description:  in.Description,
		ScoreMin:     in.ScoreMin,
		ScoreMax:     in.ScoreMax,
		Ranked:       in.Ranked,
	}
	err := utils.Insert(r.db.WithContext(ctx), &question, "cycle_id", "role_id", "question_text",
		"question_type", "is_required", "display_order", "options", "description", "score_min", "score_max", "ranked")
	return question, err
}

// ListReviewQuestions returns a cycle's review questions in display order. A
// non-nil roleID narrows to that role's questions plus the global ones.
func (r *ReviewQuestionDB) ListReviewQuestions(ctx context.Context, cycleID string, roleID *string) ([]models.ReviewQuestion, error) {
	q := r.db.WithContext(ctx).Where("cycle_id = ?", cycleID)
	if roleID != nil {
		q = q.Where("role_id = ? OR role_id IS NULL", *roleID)
	}
	questions := []models.ReviewQuestion{}
	return questions, q.Order("display_order").Order("created_at").Find(&questions).Error
}

var ErrScaleLocked = errors.New("score scale locked by existing scores")

type ScaleResolver func(cur models.ReviewQuestion) (scoreMin, scoreMax *int, err error)

func (r *ReviewQuestionDB) UpdateReviewQuestion(ctx context.Context, id string, in ReviewQuestionUpdate, scale ScaleResolver) (models.ReviewQuestion, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "question_text", in.QuestionText)
	utils.SetIf(updates, "question_type", in.QuestionType)
	utils.SetIf(updates, "is_required", in.IsRequired)
	utils.SetIf(updates, "display_order", in.DisplayOrder)
	if len(in.Options) > 0 {
		updates["options"] = models.JSONValue(in.Options)
	}
	if in.ClearDescription {
		updates["description"] = nil
	} else {
		utils.SetIf(updates, "description", in.Description)
	}
	utils.SetIf(updates, "ranked", in.Ranked)
	if scale == nil {
		return utils.UpdateReturning[models.ReviewQuestion](r.db.WithContext(ctx), updates, "id = ?", id)
	}

	var out models.ReviewQuestion
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var cur models.ReviewQuestion
		err := tx.Clauses(clause.Locking{Strength: clause.LockingStrengthUpdate}).Where("id = ?", id).Take(&cur).Error
		if err != nil {
			return utils.DBErr(err)
		}
		scoreMin, scoreMax, err := scale(cur)
		if err != nil {
			return err
		}
		if !sameInt(scoreMin, cur.ScoreMin) || !sameInt(scoreMax, cur.ScoreMax) {
			var scored bool
			err := tx.Raw("SELECT EXISTS (SELECT 1 FROM written_review_answers WHERE review_question_id = ? AND score IS NOT NULL)", id).
				Scan(&scored).Error
			if err != nil {
				return err
			}
			if scored {
				return ErrScaleLocked
			}
		}
		updates["score_min"], updates["score_max"] = nil, nil
		utils.SetIf(updates, "score_min", scoreMin)
		utils.SetIf(updates, "score_max", scoreMax)
		out, err = utils.UpdateReturning[models.ReviewQuestion](tx, updates, "id = ?", id)
		return err
	})
	return out, err
}

func (r *ReviewQuestionDB) GetReviewQuestion(ctx context.Context, id string) (models.ReviewQuestion, error) {
	var q models.ReviewQuestion
	err := r.db.WithContext(ctx).Where("id = ?", id).Take(&q).Error
	return q, utils.DBErr(err)
}

func (r *ReviewQuestionDB) DeleteReviewQuestion(ctx context.Context, id string) error {
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.ReviewQuestion{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}

// ListReviewQuestionAverages averages each lead's scores per review question
// across a cycle × role, to spot leads who score systematically high or low.
func (r *ReviewQuestionDB) ListReviewQuestionAverages(ctx context.Context, cycleID, roleID string) ([]ReviewQuestionAverageRow, error) {
	rows := []ReviewQuestionAverageRow{}
	err := r.db.WithContext(ctx).Table("written_review_answers wra").
		Select("wr.reviewer_nuid AS lead_nuid, wra.review_question_id, AVG(wra.score)::float8 AS avg_score, COUNT(*)::int AS count").
		Joins("JOIN written_reviews wr ON wr.id = wra.review_id").
		Joins("JOIN applications a ON a.id = wr.application_id").
		Where("a.cycle_id = ? AND a.role_id = ? AND wra.score IS NOT NULL", cycleID, roleID).
		Group("wr.reviewer_nuid").Group("wra.review_question_id").
		Order("wr.reviewer_nuid").
		Scan(&rows).Error
	return rows, err
}

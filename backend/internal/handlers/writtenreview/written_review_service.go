package writtenreview

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type writtenReviewService struct {
	reviewReleaseDB *reviewrelease.ReviewReleaseDB
	writtenReviewDB *WrittenReviewDB
}

func (s *writtenReviewService) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	answers := make([]ReviewAnswerInput, 0, len(in.Body.Answers))
	questionIDs := make([]string, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if _, err := uuid.Parse(a.ReviewQuestionID); err != nil {
			return nil, huma.Error422UnprocessableEntity("each answer requires a valid review_question_id")
		}
		answers = append(answers, ReviewAnswerInput(a))
		questionIDs = append(questionIDs, a.ReviewQuestionID)
	}
	if _, err := uuid.Parse(in.ID); err != nil {
		return nil, huma.Error404NotFound("application not found")
	}
	rules, err := s.writtenReviewDB.AnswerRules(ctx, in.ID, questionIDs)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	for _, a := range answers {
		if err := rules.check(a); err != nil {
			return nil, err
		}
	}

	detail, err := s.writtenReviewDB.UpsertWrittenReview(ctx, WrittenReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  utils.CurrentActor(ctx).NUID,
		Submit:        in.Body.Submit,
		Answers:       answers,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &WrittenReviewOutput{Body: detail}, nil
}

func (s *writtenReviewService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*WrittenReviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	actor := utils.CurrentActor(ctx)

	// Chiefs and admins always see every review. A plain lead sees only their
	// own until a chief releases the cycle's written reviews (blind review).
	onlyReviewer := ""
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		released, err := s.reviewReleaseDB.WrittenReviewsReleased(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if !released {
			onlyReviewer = actor.NUID
		}
	}

	items, err := s.writtenReviewDB.ListWrittenReviews(ctx, in.ID, onlyReviewer)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}

func (r answerRules) check(a ReviewAnswerInput) error {
	q, ok := r.Questions[a.ReviewQuestionID]
	if !ok || q.CycleID != r.CycleID || (q.Role != nil && *q.Role != r.Role) {
		return huma.Error422UnprocessableEntity("review question " + a.ReviewQuestionID + " doesn't apply to this application")
	}
	if q.QuestionType != models.QuestionScore {
		if a.Score != nil || a.CategoryID != nil {
			return huma.Error422UnprocessableEntity("only score questions take a score or category")
		}
		return nil
	}
	if r.Rubric == models.RubricCategory {
		if a.Score != nil {
			return huma.Error422UnprocessableEntity("this cycle rates with categories, so send category_id instead of score")
		}
		if a.CategoryID != nil && !r.Category[*a.CategoryID] {
			return huma.Error422UnprocessableEntity("category_id isn't one of this cycle's categories")
		}
		return nil
	}
	if a.CategoryID != nil {
		return huma.Error422UnprocessableEntity("this cycle rates with scores, so send score instead of category_id")
	}
	if a.Score != nil && (*a.Score < r.ScoreMin || *a.Score > r.ScoreMax) {
		return huma.Error422UnprocessableEntity(fmt.Sprintf("score must be between %d and %d", r.ScoreMin, r.ScoreMax))
	}
	return nil
}

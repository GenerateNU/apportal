package writtenreview

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type writtenReviewService struct {
	access          *access.Checker
	reviewReleaseDB *reviewrelease.ReviewReleaseDB
	writtenReviewDB *WrittenReviewDB
	gate            *pipeline.Gate
}

func (s *writtenReviewService) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	answers := make([]ReviewAnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if _, err := uuid.Parse(a.ReviewQuestionID); err != nil {
			return nil, huma.Error422UnprocessableEntity("each answer requires a valid review_question_id")
		}
		answers = append(answers, ReviewAnswerInput(a))
	}
	if err := s.gate.Application(ctx, in.ID, models.StepReviews, models.KindReviewer); err != nil {
		return nil, err
	}

	detail, err := s.writtenReviewDB.UpsertWrittenReview(ctx, WrittenReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  utils.CurrentActor(ctx).NUID,
		Submit:        in.Body.Submit,
		Answers:       answers,
	}, func(questions map[string]models.ReviewQuestion) error {
		return validateAnswers(answers, questions)
	})
	var se huma.StatusError
	if errors.As(err, &se) {
		return nil, err
	}
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &WrittenReviewOutput{Body: detail}, nil
}

func (s *writtenReviewService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*WrittenReviewsOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	// Blind review: until released, a lead sees only their own.
	visible, err := s.reviewReleaseDB.PeerReviewsVisible(ctx, s.access, models.ReviewKindWritten, []string{in.ID})
	if err != nil {
		return nil, err
	}
	onlyReviewer := ""
	if !visible[in.ID] {
		onlyReviewer = utils.CurrentActor(ctx).NUID
	}

	items, err := s.writtenReviewDB.ListWrittenReviews(ctx, in.ID, onlyReviewer)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}

func validateAnswers(answers []ReviewAnswerInput, questions map[string]models.ReviewQuestion) error {
	for _, a := range answers {
		q, ok := questions[a.ReviewQuestionID]
		if !ok {
			return huma.Error422UnprocessableEntity("review_question_id " + a.ReviewQuestionID + " is not a review question for this application")
		}
		if a.Score == nil {
			continue
		}
		if q.QuestionType != models.QuestionScore || q.ScoreMin == nil || q.ScoreMax == nil {
			return huma.Error422UnprocessableEntity("score is only allowed on score questions")
		}
		if *a.Score < *q.ScoreMin || *a.Score > *q.ScoreMax {
			return huma.Error422UnprocessableEntity(fmt.Sprintf("score for %q must be between %d and %d", q.QuestionText, *q.ScoreMin, *q.ScoreMax))
		}
	}
	return nil
}

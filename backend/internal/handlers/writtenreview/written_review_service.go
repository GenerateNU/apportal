package writtenreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type writtenReviewService struct {
	access          *access.Checker
	reviewReleaseDB *reviewrelease.ReviewReleaseDB
	writtenReviewDB *WrittenReviewDB
}

func (s *writtenReviewService) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	answers := make([]ReviewAnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.ReviewQuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a review_question_id")
		}
		answers = append(answers, ReviewAnswerInput(a))
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

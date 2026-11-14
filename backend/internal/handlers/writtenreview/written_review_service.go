package writtenreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type writtenReviewService struct {
	access          *access.Checker
	reviewReleaseDB *reviewrelease.ReviewReleaseDB
	writtenReviewDB *WrittenReviewDB
}

func (s *writtenReviewService) upsert(ctx context.Context, in *UpsertWrittenReviewInput) (*WrittenReviewOutput, error) {
	if err := s.access.RequireApplication(ctx, in.ID, access.Review); err != nil {
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
	level, err := s.access.ApplicationLevelAtLeast(ctx, in.ID, access.Review)
	if err != nil {
		return nil, err
	}
	actor := utils.CurrentActor(ctx)

	// Managers see every review. A lead sees only their own until a chief
	// releases the cycle's written reviews (blind review).
	onlyReviewer := ""
	if level < access.Manage {
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

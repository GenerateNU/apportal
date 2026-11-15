package writtenreview

import (
	"context"
	"fmt"
	"strings"

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
	submitted, err := s.writtenReviewDB.ReviewSubmitted(ctx, in.ID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if submitted {
		return nil, huma.Error409Conflict("This review was already submitted and can't be changed.")
	}
	answers := make([]ReviewAnswerInput, 0, len(in.Body.Answers))
	for _, a := range in.Body.Answers {
		if a.ReviewQuestionID == "" {
			return nil, huma.Error422UnprocessableEntity("each answer requires a review_question_id")
		}
		answers = append(answers, ReviewAnswerInput(a))
	}

	for _, a := range answers {
		if a.Score != nil && (*a.Score < 1 || *a.Score > 10) {
			return nil, huma.Error422UnprocessableEntity("Scores must be whole numbers from 1 to 10.")
		}
	}
	if in.Body.Submit {
		required, err := s.writtenReviewDB.RequiredReviewQuestionIDs(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if missing := missingRequired(required, answers); missing > 0 {
			return nil, huma.Error422UnprocessableEntity(fmt.Sprintf("Answer all required questions before submitting (%d missing).", missing))
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
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	// Blind review: until released, a lead sees only their own.
	visible, err := s.reviewReleaseDB.PeerReviewsVisible(ctx, s.access, models.ReviewKindWritten, []string{in.ID})
	if err != nil {
		return nil, err
	}
	me := utils.CurrentActor(ctx).NUID
	onlyReviewer := ""
	if !visible[in.ID] {
		onlyReviewer = me
	} else if s.access.CanApplication(ctx, access.ManageApplication, in.ID) != nil {
		// After release, a lead still sees others only once their own is in.
		submitted, err := s.writtenReviewDB.ReviewSubmitted(ctx, in.ID, me)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if !submitted {
			onlyReviewer = me
		}
	}

	items, err := s.writtenReviewDB.ListWrittenReviews(ctx, in.ID, onlyReviewer)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}

func missingRequired(required []string, answers []ReviewAnswerInput) int {
	answered := map[string]bool{}
	for _, a := range answers {
		hasText := a.AnswerText != nil && strings.TrimSpace(*a.AnswerText) != ""
		hasOptions := len(a.AnswerOptions) > 0 && string(a.AnswerOptions) != "null" && string(a.AnswerOptions) != "[]"
		if a.Score != nil || hasText || hasOptions {
			answered[a.ReviewQuestionID] = true
		}
	}
	missing := 0
	for _, id := range required {
		if !answered[id] {
			missing++
		}
	}
	return missing
}

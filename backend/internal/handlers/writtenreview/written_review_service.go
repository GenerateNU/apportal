package writtenreview

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type writtenReviewService struct {
	access          *access.Checker
	writtenReviewDB *WrittenReviewDB
	workflow        *workflow.Service
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
	if err := s.workflow.RequireWorkEditable(ctx, in.ID, workflow.WorkWrittenReview); err != nil {
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
	r, err := s.access.CanRead(ctx, in.ID, access.ReviewApplication, access.Review, workflow.WorkWrittenReview)
	if err != nil {
		return nil, err
	}
	items, err := s.readable(ctx, r)
	return &WrittenReviewsOutput{Body: items}, err
}

func (s *writtenReviewService) listBulk(ctx context.Context, in *ListBulkInput) (*WrittenReviewsOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	for _, id := range ids {
		if err := utils.RequireUUIDs("application id", id); err != nil {
			return nil, err
		}
	}
	r, err := s.access.Readable(ctx, ids, access.Review, workflow.WorkWrittenReview)
	if err != nil {
		return nil, err
	}
	items, err := s.readable(ctx, r)
	return &WrittenReviewsOutput{Body: items}, err
}

func (s *writtenReviewService) readable(ctx context.Context, r access.Readable) ([]models.WrittenReviewDetail, error) {
	peers, ownOnly := r.Split()
	all, err := s.writtenReviewDB.ListWrittenReviewsForApplications(ctx, peers, "")
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	own, err := s.writtenReviewDB.ListWrittenReviewsForApplications(ctx, ownOnly, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	items := []models.WrittenReviewDetail{}
	for _, id := range r.IDs {
		items = append(items, all[id]...)
		items = append(items, own[id]...)
	}
	return items, nil
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

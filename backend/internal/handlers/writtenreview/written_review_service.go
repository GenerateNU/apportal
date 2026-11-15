package writtenreview

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"

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
		if _, err := uuid.Parse(a.ReviewQuestionID); err != nil {
			return nil, huma.Error422UnprocessableEntity("each answer requires a valid review_question_id")
		}
		answers = append(answers, ReviewAnswerInput(a))
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
	grouped, err := s.visibleReviews(ctx, []string{in.ID})
	if err != nil {
		return nil, err
	}
	items := grouped[in.ID]
	if items == nil {
		items = []models.WrittenReviewDetail{}
	}
	return &WrittenReviewsOutput{Body: items}, nil
}

func (s *writtenReviewService) listBulk(ctx context.Context, in *ListBulkInput) (*WrittenReviewsOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	ids, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, err
	}
	grouped, err := s.visibleReviews(ctx, ids)
	if err != nil {
		return nil, err
	}
	items := []models.WrittenReviewDetail{}
	for _, id := range ids {
		items = append(items, grouped[id]...)
	}
	return &WrittenReviewsOutput{Body: items}, nil
}

func (s *writtenReviewService) visibleReviews(ctx context.Context, ids []string) (map[string][]models.WrittenReviewDetail, error) {
	me := utils.CurrentActor(ctx).NUID
	var sets peerSets
	var err error
	if sets.visible, err = s.reviewReleaseDB.PeerReviewsVisible(ctx, s.access, models.ReviewKindWritten, ids); err != nil {
		return nil, err
	}
	managed, err := s.access.VisibleApplicationIDs(ctx, ids, access.Manage)
	if err != nil {
		return nil, err
	}
	sets.managed = make(map[string]bool, len(managed))
	for _, id := range managed {
		sets.managed[id] = true
	}
	if sets.assigned, err = s.writtenReviewDB.AssignedApplications(ctx, ids, me); err != nil {
		return nil, utils.StoreErr(err)
	}
	if sets.submitted, err = s.writtenReviewDB.SubmittedApplications(ctx, ids, me); err != nil {
		return nil, utils.StoreErr(err)
	}
	grouped, err := s.writtenReviewDB.ListWrittenReviewsForApplications(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return scopeReviews(grouped, me, sets), nil
}

type peerSets struct {
	visible, managed, assigned, submitted map[string]bool
}

func scopeReviews(grouped map[string][]models.WrittenReviewDetail, me string, sets peerSets) map[string][]models.WrittenReviewDetail {
	for id, reviews := range grouped {
		if !onlyOwn(sets.visible[id], sets.managed[id], sets.assigned[id], sets.submitted[id]) {
			continue
		}
		grouped[id] = slices.DeleteFunc(reviews, func(r models.WrittenReviewDetail) bool { return r.ReviewerNUID != me })
	}
	return grouped
}

func onlyOwn(released, manager, assigned, submitted bool) bool {
	switch {
	case manager:
		return false
	case !released:
		return true
	default:
		return assigned && !submitted
	}
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

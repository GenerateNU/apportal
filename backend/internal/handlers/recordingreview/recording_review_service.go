package recordingreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type recordingReviewService struct {
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	recordingReviewDB     *RecordingReviewDB
	reviewReleaseDB       *reviewrelease.ReviewReleaseDB
}

func (s *recordingReviewService) upsert(ctx context.Context, in *UpsertRecordingReviewInput) (*RecordingReviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	actor := utils.CurrentActor(ctx)
	assigned, err := s.interviewAssignmentDB.IsReviewer(ctx, in.ID, actor.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !assigned {
		return nil, huma.Error403Forbidden("only an assigned recording reviewer may submit this review")
	}

	submitted, err := s.interviewAssignmentDB.InterviewSubmitted(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !submitted {
		return nil, huma.Error409Conflict("the interview write-up hasn't been submitted yet")
	}

	err = s.recordingReviewDB.SaveRecordingReview(ctx, RecordingReviewUpsert{
		ApplicationID: in.ID,
		ReviewerNUID:  actor.NUID,
		Writeup:       in.Body.Writeup,
		Rating:        in.Body.Rating,
		Submit:        in.Body.Submit,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return s.list(ctx, &utils.ApplicationScopedInput{ID: in.ID})
}

func (s *recordingReviewService) list(ctx context.Context, in *utils.ApplicationScopedInput) (*RecordingReviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.interviewAssignmentDB.ListReviewers(ctx, []string{in.ID})
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	actor := utils.CurrentActor(ctx)
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		released, err := s.reviewReleaseDB.RecordingReviewsReleased(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if !released {
			for i := range items {
				if items[i].ReviewerNUID != actor.NUID {
					items[i].Writeup = nil
				}
			}
		}
	}
	return &RecordingReviewsOutput{Body: items}, nil
}

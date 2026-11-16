package recordingreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type recordingReviewService struct {
	access                *access.Checker
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	recordingReviewDB     *RecordingReviewDB
	workflow              *workflow.Service
}

func (s *recordingReviewService) upsert(ctx context.Context, in *UpsertRecordingReviewInput) (*RecordingReviewsOutput, error) {
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}
	app, err := s.access.Application(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := app.Can(access.SubmitRecordingReview); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil {
		if err := app.Can(access.OverrideInterviewRating); err != nil {
			return nil, err
		}
	}
	if err := s.workflow.RequireWorkEditable(ctx, in.ID, workflow.WorkRecordingReview); err != nil {
		return nil, err
	}
	actor := utils.CurrentActor(ctx)

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
	r, err := s.access.CanRead(ctx, in.ID, access.ReviewApplication, access.Review, workflow.WorkRecordingReview)
	if err != nil {
		return nil, err
	}
	items, err := s.interviewAssignmentDB.ListReviewers(ctx, r.IDs)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	r.HidePeerWriteups(items, utils.CurrentActor(ctx).NUID)
	return &RecordingReviewsOutput{Body: items}, nil
}

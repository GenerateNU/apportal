package interview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type interviewService struct {
	applicationDB         *application.ApplicationDB
	interviewDB           *InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
}

func (s *interviewService) listBulk(ctx context.Context, in *ListInterviewsBulkInput) (*InterviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.interviewDB.ListInterviewDetails(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewsOutput{Body: items}, nil
}

func (s *interviewService) upsert(ctx context.Context, in *UpsertInterviewInput) (*InterviewOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	actor := utils.CurrentActor(ctx)
	assigned, err := s.interviewAssignmentDB.IsInterviewer(ctx, in.ID, actor.NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !assigned {
		return nil, huma.Error403Forbidden("only an assigned interviewer may edit this interview")
	}

	err = s.interviewDB.UpsertInterview(ctx, InterviewUpsert{
		ApplicationID:   in.ID,
		InterviewerNUID: actor.NUID,
		ScheduledAt:     in.Body.ScheduledAt,
		ConductedAt:     in.Body.ConductedAt,
		RecordingURL:    in.Body.RecordingURL,
		NotesURL:        in.Body.NotesURL,
		Rating:          in.Body.Rating,
		Writeup:         in.Body.Writeup,
		Submit:          in.Body.Submit,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	if in.Body.Submit {
		if done, err := s.interviewAssignmentDB.AllInterviewersSubmitted(ctx, in.ID); err == nil && done {
			_ = s.applicationDB.AdvanceApplicationToInterviewReview(ctx, in.ID)
		}
	}

	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

func (s *interviewService) get(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

package interview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type interviewService struct {
	access                *access.Checker
	applicationDB         *application.ApplicationDB
	interviewDB           *InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	gate                  *pipeline.Gate
}

func (s *interviewService) listBulk(ctx context.Context, in *ListInterviewsBulkInput) (*InterviewsOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	ids, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, err
	}
	items, err := s.interviewDB.ListInterviewDetails(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewsOutput{Body: items}, nil
}

func (s *interviewService) upsert(ctx context.Context, in *UpsertInterviewInput) (*InterviewOutput, error) {
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}
	app, err := s.access.Application(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := app.Can(access.EditInterview); err != nil {
		return nil, err
	}
	if in.Body.Writeup != nil || in.Body.RecordingURL != nil || in.Body.NotesURL != nil || in.Body.Submit {
		if err := app.Can(access.WriteInterviewNotes); err != nil {
			return nil, err
		}
	}
	if in.Body.Submit || in.Body.Writeup != nil || in.Body.Rating != nil {
		if err := s.gate.Application(ctx, in.ID, models.StepInterviews, models.KindInterviewer); err != nil {
			return nil, err
		}
	}
	actor := utils.CurrentActor(ctx)
	current, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if in.Body.Submit && in.Body.Rating == nil && current.Rating == nil {
		return nil, huma.Error422UnprocessableEntity("a rating is required to submit")
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
		if err := s.applicationDB.AdvanceApplicationToInterviewReview(ctx, in.ID); err != nil {
			return nil, utils.StoreErr(err)
		}
	}

	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

func (s *interviewService) get(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewOutput, error) {
	if err := s.access.CanApplication(ctx, access.ReviewApplication, in.ID); err != nil {
		return nil, err
	}
	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

package interview

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type interviewService struct {
	access                *access.Checker
	applicationDB         *application.ApplicationDB
	interviewDB           *InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
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
	actor := utils.CurrentActor(ctx)
	current, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if in.Body.Submit || current.SubmittedAt != nil {
		if msg := missingForSubmit(in, current.Interview); msg != "" {
			return nil, huma.Error422UnprocessableEntity(msg)
		}
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
		_ = s.applicationDB.AdvanceApplicationToInterviewReview(ctx, in.ID)
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

func missingForSubmit(in *UpsertInterviewInput, current models.Interview) string {
	filled := func(next, saved *string) bool {
		if next != nil {
			return strings.TrimSpace(*next) != ""
		}
		return saved != nil && strings.TrimSpace(*saved) != ""
	}
	switch {
	case !filled(in.Body.RecordingURL, current.RecordingURL):
		return "a recording link is required to submit"
	case !filled(in.Body.NotesURL, current.NotesURL):
		return "a notes link is required to submit"
	case !filled(in.Body.Writeup, current.Writeup):
		return "a write-up is required to submit"
	case in.Body.Rating == nil && current.Rating == nil:
		return "a rating is required to submit"
	}
	return ""
}

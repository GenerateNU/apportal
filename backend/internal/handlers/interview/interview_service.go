package interview

import (
	"context"

	"gorm.io/gorm"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

type interviewService struct {
	access                *access.Checker
	applicationDB         *application.ApplicationDB
	interviewDB           *InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	workflow              *workflow.Service
}

func (s *interviewService) listBulk(ctx context.Context, in *ListInterviewsBulkInput) (*InterviewsOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	r, err := s.access.Readable(ctx, ids, access.Review, workflow.WorkInterview)
	if err != nil {
		return nil, err
	}
	items, err := s.interviewDB.ListInterviewDetails(ctx, r.IDs)
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
	work := workflow.WorkInterviewSchedule
	if in.Body.Submit || in.Body.Writeup != nil || in.Body.Rating != nil {
		work = workflow.WorkInterview
	}
	actor := utils.CurrentActor(ctx)
	err = s.interviewDB.SaveInterview(ctx, InterviewUpsert{
		ApplicationID:   in.ID,
		InterviewerNUID: actor.NUID,
		ScheduledAt:     in.Body.ScheduledAt,
		ConductedAt:     in.Body.ConductedAt,
		RecordingURL:    in.Body.RecordingURL,
		NotesURL:        in.Body.NotesURL,
		Rating:          in.Body.Rating,
		Writeup:         in.Body.Writeup,
		Submit:          in.Body.Submit,
	}, func(tx *gorm.DB, current *models.Interview) error {
		if err := s.workflow.In(tx).RequireWorkEditable(ctx, in.ID, work); err != nil {
			return err
		}
		if in.Body.Submit && in.Body.Rating == nil && (current == nil || current.Rating == nil) {
			return huma.Error422UnprocessableEntity("a rating is required to submit")
		}
		return nil
	}, func(tx *gorm.DB) error {
		if !in.Body.Submit {
			return nil
		}
		return application.AdvanceToInterviewReview(ctx, tx, in.ID)
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

func (s *interviewService) get(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewOutput, error) {
	r, err := s.access.CanRead(ctx, in.ID, access.ReviewApplication, access.Review, workflow.WorkInterview)
	if err != nil {
		return nil, err
	}
	if !r.Has(in.ID) {
		return nil, huma.Error404NotFound("this cycle doesn't run interviews")
	}
	iv, err := s.interviewDB.GetInterviewDetail(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

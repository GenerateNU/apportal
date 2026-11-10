package interview

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
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
	ids := make([]string, 0, 8)
	for _, id := range strings.Split(in.ApplicationIDs, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return &InterviewsOutput{Body: []models.Interview{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.interviewDB.ListInterviewsForApplications(ctx, ids)
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
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	assignment, assignErr := s.interviewAssignmentDB.GetInterviewAssignment(ctx, in.ID)
	if !isChief && (assignErr != nil || assignment.InterviewerNUID != actor.NUID) {
		return nil, huma.Error403Forbidden("only the assigned interviewer may submit this interview")
	}

	// Attribute the write-up to whoever is actually assigned, even when a
	// chief is the one editing it — only fall back to the caller's own NUID
	// when there's no assignment to attribute it to at all.
	interviewerNUID := actor.NUID
	if assignErr == nil && assignment.InterviewerNUID != "" {
		interviewerNUID = assignment.InterviewerNUID
	}

	iv, err := s.interviewDB.UpsertInterview(ctx, InterviewUpsert{
		ApplicationID:   in.ID,
		InterviewerNUID: interviewerNUID,
		ScheduledAt:     in.Body.ScheduledAt,
		ConductedAt:     in.Body.ConductedAt,
		RecordingURL:    in.Body.RecordingURL,
		NotesURL:        in.Body.NotesURL,
		Comments:        in.Body.Comments,
		Rating:          in.Body.Rating,
		Submit:          in.Body.Submit,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	// Submitting is the signal that the applicant has moved from "being
	// interviewed" to "under interview review" — best-effort: the write-up
	// itself already succeeded, so a failure here shouldn't fail the request.
	if in.Body.Submit {
		_ = s.applicationDB.AdvanceApplicationToInterviewReview(ctx, in.ID)
	}

	return &InterviewOutput{Body: iv}, nil
}

func (s *interviewService) get(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	iv, err := s.interviewDB.GetInterview(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

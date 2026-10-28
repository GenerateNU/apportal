package recordingreview

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type recordingReviewService struct {
	interviewDB           *interview.InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	recordingReviewDB     *RecordingReviewDB
	reviewReleaseDB       *reviewrelease.ReviewReleaseDB
}

func (s *recordingReviewService) upsert(ctx context.Context, in *UpsertRecordingReviewInput) (*RecordingReviewOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	interview, err := s.interviewDB.GetInterviewByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// The interviewer hasn't finished yet — nothing to review, and nothing a
	// reviewer writes now would have anything to go on.
	if interview.SubmittedAt == nil {
		return nil, huma.Error409Conflict("the interviewer hasn't submitted this interview yet")
	}

	actor := utils.CurrentActor(ctx)
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		assignments, err := s.interviewAssignmentDB.ListInterviewReviewAssignments(ctx, interview.ApplicationID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		assigned := false
		for _, a := range assignments {
			if a.LeadNUID == actor.NUID {
				assigned = true
				break
			}
		}
		if !assigned {
			return nil, huma.Error403Forbidden("only an assigned recording reviewer may submit this review")
		}
	}

	review, err := s.recordingReviewDB.UpsertRecordingReview(ctx, RecordingReviewUpsert{
		InterviewID:  in.ID,
		ReviewerNUID: actor.NUID,
		Comments:     in.Body.Comments,
		Rating:       in.Body.Rating,
		Submit:       in.Body.Submit,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &RecordingReviewOutput{Body: review}, nil
}

func (s *recordingReviewService) listBulk(ctx context.Context, in *ListRecordingReviewsBulkInput) (*RecordingReviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := utils.SplitIDs(in.InterviewIDs)
	if len(ids) == 0 {
		return &RecordingReviewsOutput{Body: []models.InterviewRecordingReview{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many interview_ids")
	}
	items, err := s.recordingReviewDB.ListRecordingReviewsForInterviews(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// Comments are never useful for a progress count and would otherwise need
	// a per-interview release check to redact correctly — just omit them.
	for i := range items {
		items[i].Comments = nil
	}
	return &RecordingReviewsOutput{Body: items}, nil
}

func (s *recordingReviewService) list(ctx context.Context, in *InterviewScopedInput) (*RecordingReviewsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.recordingReviewDB.ListRecordingReviews(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	// The recording itself (on the interview) is always visible. Only peers'
	// written comments are blind: a plain lead sees other reviewers' comments
	// redacted until a chief releases the cycle's recording reviews for that
	// role. Chiefs and admins always see everything.
	actor := utils.CurrentActor(ctx)
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		released, err := s.reviewReleaseDB.RecordingReviewsReleased(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if !released {
			for i := range items {
				if items[i].ReviewerNUID != actor.NUID {
					items[i].Comments = nil
				}
			}
		}
	}
	return &RecordingReviewsOutput{Body: items}, nil
}

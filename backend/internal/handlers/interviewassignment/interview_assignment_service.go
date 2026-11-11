package interviewassignment

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type interviewAssignmentService struct {
	interviewAssignmentDB *InterviewAssignmentDB
}

func (s *interviewAssignmentService) addInterviewer(ctx context.Context, in *AddInterviewerInput) (*InterviewerOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	row, err := s.interviewAssignmentDB.AddInterviewer(ctx, in.ID, in.Body.InterviewerNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewerOutput{Body: row}, nil
}

func (s *interviewAssignmentService) removeInterviewer(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.interviewAssignmentDB.RemoveInterviewer(ctx, in.ID); err != nil {
		if err == utils.ErrConflict {
			return nil, huma.Error409Conflict("the interview has already been conducted")
		}
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewAssignmentService) addReviewer(ctx context.Context, in *AddReviewerInput) (*InterviewReviewerOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	row, err := s.interviewAssignmentDB.AddReviewer(ctx, in.ID, in.Body.ReviewerNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewReviewerOutput{Body: row}, nil
}

func (s *interviewAssignmentService) removeReviewer(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.interviewAssignmentDB.RemoveReviewer(ctx, in.ID); err != nil {
		if err == utils.ErrConflict {
			return nil, huma.Error409Conflict("the reviewer has already submitted their review")
		}
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewAssignmentService) listReviewersBulk(ctx context.Context, in *ListBulkInput) (*InterviewReviewersOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.interviewAssignmentDB.ListReviewers(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	for i := range items {
		items[i].Writeup = nil
	}
	return &InterviewReviewersOutput{Body: items}, nil
}

func (s *interviewAssignmentService) unassignAllInterviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	return s.unassignAll(ctx, in, s.interviewAssignmentDB.DeleteInterviewersForCycle)
}

func (s *interviewAssignmentService) unassignAllReviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	return s.unassignAll(ctx, in, s.interviewAssignmentDB.DeleteReviewersForCycle)
}

func (s *interviewAssignmentService) unassignAll(ctx context.Context, in *UnassignAllInput, del func(context.Context, string, models.Role) (int, error)) (*UnassignAllOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := del(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

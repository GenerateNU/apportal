package interviewassignment

import (
	"context"
	"errors"

	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"

	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"gorm.io/gorm"
)

type interviewAssignmentService struct {
	gate                  access.Gate
	guard                 *staffing.Guard
	access                *access.Checker
	interviewAssignmentDB *InterviewAssignmentDB
	reviewReleaseDB       *reviewrelease.ReviewReleaseDB
}

func (s *interviewAssignmentService) addInterviewer(ctx context.Context, in *AddInterviewerInput) (*InterviewerOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	if err := s.gate.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	nuid := in.Body.InterviewerNUID
	row, err := s.interviewAssignmentDB.AddInterviewer(ctx, in.ID, nuid, utils.CurrentActor(ctx).NUID, func(tx *gorm.DB) error {
		return s.guard.CheckAdd(ctx, tx, in.ID, nuid, models.KindInterviewer)
	})
	if err != nil {
		return nil, staffing.HTTPError(err)
	}
	return &InterviewerOutput{Body: row}, nil
}

func (s *interviewAssignmentService) removeInterviewer(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := s.access.CanInterviewRow(ctx, access.ManageApplication, "interviewers", in.ID); err != nil {
		return nil, err
	}
	if err := s.interviewAssignmentDB.RemoveInterviewer(ctx, in.ID); err != nil {
		if errors.Is(err, utils.ErrConflict) {
			return nil, huma.Error409Conflict("the interviewer has already submitted notes or the interview was conducted")
		}
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewAssignmentService) addReviewer(ctx context.Context, in *AddReviewerInput) (*InterviewReviewerOutput, error) {
	if err := utils.RequireUUIDs("application id", in.ID); err != nil {
		return nil, err
	}
	if err := s.gate.CanApplication(ctx, access.ManageApplication, in.ID); err != nil {
		return nil, err
	}
	nuid := in.Body.ReviewerNUID
	row, err := s.interviewAssignmentDB.AddReviewer(ctx, in.ID, nuid, utils.CurrentActor(ctx).NUID, func(tx *gorm.DB) error {
		return s.guard.CheckAdd(ctx, tx, in.ID, nuid, models.KindRecordingReviewer)
	})
	if err != nil {
		return nil, staffing.HTTPError(err)
	}
	return &InterviewReviewerOutput{Body: row}, nil
}

func (s *interviewAssignmentService) removeReviewer(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := s.access.CanInterviewRow(ctx, access.ManageApplication, "interview_reviewers", in.ID); err != nil {
		return nil, err
	}
	if err := s.interviewAssignmentDB.RemoveReviewer(ctx, in.ID); err != nil {
		if errors.Is(err, utils.ErrConflict) {
			return nil, huma.Error409Conflict("the reviewer has already submitted their review")
		}
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewAssignmentService) listReviewersBulk(ctx context.Context, in *ListBulkInput) (*InterviewReviewersOutput, error) {
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	ids, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, err
	}
	items, err := s.interviewAssignmentDB.ListReviewers(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	visible, err := s.reviewReleaseDB.PeerReviewsVisible(ctx, s.access, models.ReviewKindRecording, ids)
	if err != nil {
		return nil, err
	}
	reviewrelease.HidePeerWriteups(items, utils.CurrentActor(ctx).NUID, visible)
	return &InterviewReviewersOutput{Body: items}, nil
}

func (s *interviewAssignmentService) unassignAllInterviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	return s.unassignAll(ctx, in, s.interviewAssignmentDB.DeleteInterviewersForCycle)
}

func (s *interviewAssignmentService) unassignAllReviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	return s.unassignAll(ctx, in, s.interviewAssignmentDB.DeleteReviewersForCycle)
}

func (s *interviewAssignmentService) unassignAll(ctx context.Context, in *UnassignAllInput, del func(context.Context, string, string) (int, error)) (*UnassignAllOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.CanCycle(ctx, access.ManageCycle, in.ID); err != nil {
		return nil, err
	}
	deleted, err := del(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

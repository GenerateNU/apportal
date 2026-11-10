package interviewassignment

import (
	"context"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type interviewAssignmentService struct {
	interviewAssignmentDB *InterviewAssignmentDB
}

func (s *interviewAssignmentService) setInterviewer(ctx context.Context, in *SetInterviewAssignmentInput) (*InterviewAssignmentOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.InterviewerNUID == "" {
		return nil, huma.Error422UnprocessableEntity("interviewer_nuid is required")
	}
	a, err := s.interviewAssignmentDB.UpsertInterviewAssignment(ctx, in.ID, in.Body.InterviewerNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewAssignmentOutput{Body: a}, nil
}

func (s *interviewAssignmentService) getInterviewer(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewAssignmentOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	a, err := s.interviewAssignmentDB.GetInterviewAssignment(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewAssignmentOutput{Body: a}, nil
}

func parseBulkIDs(raw string) []string {
	ids := make([]string, 0, 8)
	for _, id := range strings.Split(raw, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func (s *interviewAssignmentService) listInterviewerAssignmentsBulk(ctx context.Context, in *ListAssignmentsBulkInput) (*InterviewAssignmentsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := parseBulkIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &InterviewAssignmentsOutput{Body: []models.InterviewAssignment{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.interviewAssignmentDB.ListInterviewAssignmentsForApplications(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewAssignmentsOutput{Body: items}, nil
}

func (s *interviewAssignmentService) listReviewerAssignmentsBulk(ctx context.Context, in *ListAssignmentsBulkInput) (*InterviewReviewAssignmentsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := parseBulkIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &InterviewReviewAssignmentsOutput{Body: []models.InterviewReviewAssignment{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := s.interviewAssignmentDB.ListInterviewReviewAssignmentsForApplications(ctx, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewReviewAssignmentsOutput{Body: items}, nil
}

func (s *interviewAssignmentService) assignReviewer(ctx context.Context, in *AssignRecordingReviewerInput) (*InterviewReviewAssignmentOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	a, err := s.interviewAssignmentDB.CreateInterviewReviewAssignment(ctx, in.ID, in.Body.LeadNUID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewReviewAssignmentOutput{Body: a}, nil
}

func (s *interviewAssignmentService) listReviewers(ctx context.Context, in *utils.ApplicationScopedInput) (*InterviewReviewAssignmentsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := s.interviewAssignmentDB.ListInterviewReviewAssignments(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewReviewAssignmentsOutput{Body: items}, nil
}

func (s *interviewAssignmentService) unassignReviewer(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.interviewAssignmentDB.DeleteInterviewReviewAssignment(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *interviewAssignmentService) unassignAllInterviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := s.interviewAssignmentDB.DeleteInterviewAssignmentsForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

func (s *interviewAssignmentService) unassignAllReviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := s.interviewAssignmentDB.DeleteInterviewReviewAssignmentsForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

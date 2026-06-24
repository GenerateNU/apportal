package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type interviewAssignmentHandler struct {
	store *store.Store
}

func (h *interviewAssignmentHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "set-interview-assignment",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview-assignment",
		Summary:     "Assign the interviewer for an application",
		Description: "Chief only. One interviewer per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden},
	}, h.setInterviewer)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview-assignment",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-assignment",
		Summary:     "Get an application's interviewer assignment",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.getInterviewer)

	huma.Register(api, huma.Operation{
		OperationID:   "assign-recording-reviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interview-review-assignments",
		Summary:       "Assign a TL to review the interview recording",
		Description:   "Chief only. Chiefs assign 2 TLs per interview.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict},
	}, h.assignReviewer)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviewer-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-review-assignments",
		Summary:     "List recording-review assignments",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.listReviewers)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-recording-reviewer",
		Method:        http.MethodDelete,
		Path:          "/interview-review-assignments/{id}",
		Summary:       "Remove a recording-review assignment",
		Description:   "Chief only.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.unassignReviewer)
}

type InterviewAssignmentOutput struct {
	Body models.InterviewAssignment
}

type SetInterviewAssignmentInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		InterviewerNUID string `json:"interviewer_nuid"`
	}
}

func (h *interviewAssignmentHandler) setInterviewer(ctx context.Context, in *SetInterviewAssignmentInput) (*InterviewAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	a, err := h.store.UpsertInterviewAssignment(ctx, in.ID, in.Body.InterviewerNUID, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewAssignmentOutput{Body: a}, nil
}

func (h *interviewAssignmentHandler) getInterviewer(ctx context.Context, in *ApplicationScopedInput) (*InterviewAssignmentOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	a, err := h.store.GetInterviewAssignment(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewAssignmentOutput{Body: a}, nil
}

type InterviewReviewAssignmentOutput struct {
	Body models.InterviewReviewAssignment
}

type InterviewReviewAssignmentsOutput struct {
	Body []models.InterviewReviewAssignment
}

type AssignRecordingReviewerInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		TLNUID string `json:"tl_nuid"`
	}
}

func (h *interviewAssignmentHandler) assignReviewer(ctx context.Context, in *AssignRecordingReviewerInput) (*InterviewReviewAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	a, err := h.store.CreateInterviewReviewAssignment(ctx, in.ID, in.Body.TLNUID, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewReviewAssignmentOutput{Body: a}, nil
}

func (h *interviewAssignmentHandler) listReviewers(ctx context.Context, in *ApplicationScopedInput) (*InterviewReviewAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListInterviewReviewAssignments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewReviewAssignmentsOutput{Body: items}, nil
}

func (h *interviewAssignmentHandler) unassignReviewer(ctx context.Context, in *IDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteInterviewReviewAssignment(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

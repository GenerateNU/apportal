package handlers

import (
	"context"
	"net/http"
	"strings"

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
		OperationID: "list-interview-assignments-bulk",
		Method:      http.MethodGet,
		Path:        "/interview-assignments",
		Summary:     "List interviewer assignments for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listInterviewerAssignmentsBulk)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-review-assignments-bulk",
		Method:      http.MethodGet,
		Path:        "/interview-review-assignments",
		Summary:     "List recording-reviewer assignments for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listReviewerAssignmentsBulk)

	huma.Register(api, huma.Operation{
		OperationID:   "assign-recording-reviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interview-review-assignments",
		Summary:       "Assign a lead to review the interview recording",
		Description:   "Chief only. Chiefs assign 2 leads per interview.",
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

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-interviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interview-assignments",
		Summary:     "Remove every interviewer assignment for a cycle's role",
		Description: "Chief only. Deletes all interviewer assignments for one applicant " +
			"role in a cycle at once. Cannot be undone.",
		Tags:   []string{"Interview assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.unassignAllInterviewers)

	huma.Register(api, huma.Operation{
		OperationID: "unassign-all-recording-reviewers",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/interview-review-assignments",
		Summary:     "Remove every recording-review assignment for a cycle's role",
		Description: "Chief only. Deletes all recording-review assignments for one " +
			"applicant role in a cycle at once. Cannot be undone.",
		Tags:   []string{"Interview assignments"},
		Errors: []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.unassignAllReviewers)
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
	if in.Body.InterviewerNUID == "" {
		return nil, huma.Error422UnprocessableEntity("interviewer_nuid is required")
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

type InterviewAssignmentsOutput struct {
	Body []models.InterviewAssignment
}

type ListAssignmentsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
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

func (h *interviewAssignmentHandler) listInterviewerAssignmentsBulk(ctx context.Context, in *ListAssignmentsBulkInput) (*InterviewAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := parseBulkIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &InterviewAssignmentsOutput{Body: []models.InterviewAssignment{}}, nil
	}
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := h.store.ListInterviewAssignmentsForApplications(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewAssignmentsOutput{Body: items}, nil
}

func (h *interviewAssignmentHandler) listReviewerAssignmentsBulk(ctx context.Context, in *ListAssignmentsBulkInput) (*InterviewReviewAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := parseBulkIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &InterviewReviewAssignmentsOutput{Body: []models.InterviewReviewAssignment{}}, nil
	}
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := h.store.ListInterviewReviewAssignmentsForApplications(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewReviewAssignmentsOutput{Body: items}, nil
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
		LeadNUID string `json:"lead_nuid"`
	}
}

func (h *interviewAssignmentHandler) assignReviewer(ctx context.Context, in *AssignRecordingReviewerInput) (*InterviewReviewAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.LeadNUID == "" {
		return nil, huma.Error422UnprocessableEntity("lead_nuid is required")
	}
	a, err := h.store.CreateInterviewReviewAssignment(ctx, in.ID, in.Body.LeadNUID, currentActor(ctx).NUID)
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

// UnassignAllInput identifies a cycle-and-role-scoped bulk-delete.
type UnassignAllInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type UnassignAllOutput struct {
	Body struct {
		Deleted int `json:"deleted" doc:"Number of assignments removed"`
	}
}

func (h *interviewAssignmentHandler) unassignAllInterviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := h.store.DeleteInterviewAssignmentsForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

func (h *interviewAssignmentHandler) unassignAllReviewers(ctx context.Context, in *UnassignAllInput) (*UnassignAllOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role is invalid")
	}
	deleted, err := h.store.DeleteInterviewReviewAssignmentsForCycle(ctx, in.ID, in.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	out := &UnassignAllOutput{}
	out.Body.Deleted = deleted
	return out, nil
}

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
		OperationID:   "add-interviewer",
		Method:        http.MethodPost,
		Path:          "/applications/{id}/interview-assignments",
		Summary:       "Add an interviewer to an application",
		Description:   "Chief only. An application may have several interviewers.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.addInterviewer)

	huma.Register(api, huma.Operation{
		OperationID:   "add-interviewer-bulk",
		Method:        http.MethodPost,
		Path:          "/interview-assignments",
		Summary:       "Add one interviewer to several applications",
		Description:   "Chief only. Applications that already have this interviewer are skipped; returns only the assignments created.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.addInterviewerBulk)

	huma.Register(api, huma.Operation{
		OperationID: "list-interview-assignments",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview-assignments",
		Summary:     "List an application's interviewers",
		Tags:        []string{"Interview assignments"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.listInterviewers)

	huma.Register(api, huma.Operation{
		OperationID:   "unassign-interviewer",
		Method:        http.MethodDelete,
		Path:          "/interview-assignments/{id}",
		Summary:       "Remove an interviewer assignment",
		Description:   "Chief only. The interviewer's write-up, if any, is kept.",
		Tags:          []string{"Interview assignments"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.unassignInterviewer)

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

type AddInterviewerInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		InterviewerNUID string `json:"interviewer_nuid"`
	}
}

func (h *interviewAssignmentHandler) addInterviewer(ctx context.Context, in *AddInterviewerInput) (*InterviewAssignmentOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	nuid := strings.TrimSpace(in.Body.InterviewerNUID)
	if nuid == "" {
		return nil, huma.Error422UnprocessableEntity("interviewer_nuid is required")
	}
	a, err := h.store.CreateInterviewAssignment(ctx, in.ID, nuid, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewAssignmentOutput{Body: a}, nil
}

type InterviewAssignmentsOutput struct {
	Body []models.InterviewAssignment
}

type AddInterviewerBulkInput struct {
	Body struct {
		ApplicationIDs  []string `json:"application_ids" minItems:"1"`
		InterviewerNUID string   `json:"interviewer_nuid"`
	}
}

func (h *interviewAssignmentHandler) addInterviewerBulk(ctx context.Context, in *AddInterviewerBulkInput) (*InterviewAssignmentsOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	nuid := strings.TrimSpace(in.Body.InterviewerNUID)
	if nuid == "" {
		return nil, huma.Error422UnprocessableEntity("interviewer_nuid is required")
	}
	if len(in.Body.ApplicationIDs) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := h.store.AddInterviewerToApplications(ctx, in.Body.ApplicationIDs, nuid, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	if items == nil {
		items = []models.InterviewAssignment{}
	}
	return &InterviewAssignmentsOutput{Body: items}, nil
}

func (h *interviewAssignmentHandler) listInterviewers(ctx context.Context, in *ApplicationScopedInput) (*InterviewAssignmentsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListInterviewAssignments(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewAssignmentsOutput{Body: items}, nil
}

func (h *interviewAssignmentHandler) unassignInterviewer(ctx context.Context, in *IDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteInterviewAssignment(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
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

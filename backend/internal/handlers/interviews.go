package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type interviewHandler struct {
	store *store.Store
}

func (h *interviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-interview",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/interview",
		Summary:     "Create or update the interview write-up",
		Description: "Reviewer only (the interviewer). Provided fields overwrite; omitted ones are preserved.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "get-interview",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interview",
		Summary:     "Get an application's interview",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "list-interviews-bulk",
		Method:      http.MethodGet,
		Path:        "/interviews",
		Summary:     "List interviews for several applications",
		Description: "Reviewer only. One request for a page of applications, instead of one per application.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listBulk)
}

type InterviewOutput struct {
	Body models.Interview
}

type InterviewsOutput struct {
	Body []models.Interview
}

type ListInterviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

func (h *interviewHandler) listBulk(ctx context.Context, in *ListInterviewsBulkInput) (*InterviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
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
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}
	items, err := h.store.ListInterviewsForApplications(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewsOutput{Body: items}, nil
}

type UpsertInterviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		ScheduledAt  *time.Time              `json:"scheduled_at,omitempty"`
		ConductedAt  *time.Time              `json:"conducted_at,omitempty"`
		RecordingURL *string                 `json:"recording_url,omitempty"`
		NotesURL     *string                 `json:"notes_url,omitempty"`
		Comments     *string                 `json:"comments,omitempty"`
		Rating       *models.InterviewRating `json:"rating,omitempty"`
		Submit       bool                    `json:"submit,omitempty" doc:"When true, marks the interview as submitted"`
	}
}

func (h *interviewHandler) upsert(ctx context.Context, in *UpsertInterviewInput) (*InterviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	actor := currentActor(ctx)
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	assignment, assignErr := h.store.GetInterviewAssignment(ctx, in.ID)
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

	iv, err := h.store.UpsertInterview(ctx, store.InterviewUpsert{
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
		return nil, storeErr(err)
	}

	// Submitting is the signal that the applicant has moved from "being
	// interviewed" to "under interview review" — best-effort: the write-up
	// itself already succeeded, so a failure here shouldn't fail the request.
	if in.Body.Submit {
		_ = h.store.AdvanceApplicationToInterviewReview(ctx, in.ID)
	}

	return &InterviewOutput{Body: iv}, nil
}

func (h *interviewHandler) get(ctx context.Context, in *ApplicationScopedInput) (*InterviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	iv, err := h.store.GetInterview(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewOutput{Body: iv}, nil
}

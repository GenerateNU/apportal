package handlers

import (
	"context"
	"net/http"
	"slices"
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
		Summary:     "Create or update the caller's interview write-up",
		Description: "Assigned interviewers, or a chief (on behalf of an assigned interviewer, or as themself when none is). Provided fields overwrite; omitted ones are preserved.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-interviews",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/interviews",
		Summary:     "List an application's interview write-ups",
		Description: "Reviewer only. One write-up per interviewer.",
		Tags:        []string{"Interviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

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
		ScheduledAt     *time.Time              `json:"scheduled_at,omitempty"`
		ConductedAt     *time.Time              `json:"conducted_at,omitempty"`
		RecordingURL    *string                 `json:"recording_url,omitempty"`
		NotesURL        *string                 `json:"notes_url,omitempty"`
		Comments        *string                 `json:"comments,omitempty"`
		Rating          *models.InterviewRating `json:"rating,omitempty"`
		Submit          bool                    `json:"submit,omitempty" doc:"When true, marks the interview as submitted"`
		InterviewerNUID string                  `json:"interviewer_nuid,omitempty" doc:"Chief only. Which assigned interviewer's write-up to edit; may be omitted when exactly one is assigned."`
	}
}

func (h *interviewHandler) upsert(ctx context.Context, in *UpsertInterviewInput) (*InterviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	interviewerNUID, err := h.writeUpOwner(ctx, in.ID, strings.TrimSpace(in.Body.InterviewerNUID))
	if err != nil {
		return nil, err
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

	if in.Body.Submit {
		_ = h.store.AdvanceApplicationToInterviewReview(ctx, in.ID)
	}

	return &InterviewOutput{Body: iv}, nil
}

func (h *interviewHandler) writeUpOwner(ctx context.Context, applicationID, requested string) (string, error) {
	actor := currentActor(ctx)
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)
	if requested != "" && !isChief {
		return "", huma.Error403Forbidden("chief role required to edit another interviewer's write-up")
	}

	assignments, err := h.store.ListInterviewAssignments(ctx, applicationID)
	if err != nil {
		return "", storeErr(err)
	}
	assigned := func(nuid string) bool {
		return slices.ContainsFunc(assignments, func(a models.InterviewAssignment) bool { return a.InterviewerNUID == nuid })
	}

	switch {
	case requested != "":
		if !assigned(requested) {
			return "", huma.Error422UnprocessableEntity("interviewer_nuid is not assigned to this application")
		}
		return requested, nil
	case assigned(actor.NUID):
		return actor.NUID, nil
	case !isChief:
		return "", huma.Error403Forbidden("only an assigned interviewer may submit this interview")
	case len(assignments) == 0:
		return actor.NUID, nil
	case len(assignments) == 1:
		return assignments[0].InterviewerNUID, nil
	default:
		return "", huma.Error422UnprocessableEntity("interviewer_nuid is required when several interviewers are assigned")
	}
}

func (h *interviewHandler) list(ctx context.Context, in *ApplicationScopedInput) (*InterviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListInterviews(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewsOutput{Body: items}, nil
}

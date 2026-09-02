package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type recordingReviewHandler struct {
	store *store.Store
}

func (h *recordingReviewHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "upsert-recording-review",
		Method:      http.MethodPut,
		Path:        "/interviews/{id}/recording-review",
		Summary:     "Submit or update your interview recording review",
		Description: "Reviewer only; upserts the calling reviewer's review of the recording.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.upsert)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviews",
		Method:      http.MethodGet,
		Path:        "/interviews/{id}/recording-reviews",
		Summary:     "List an interview's recording reviews",
		Description: "Leads see only their own review until a chief releases the cycle's recording reviews; chiefs and admins always see every review.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-recording-reviews-bulk",
		Method:      http.MethodGet,
		Path:        "/recording-reviews",
		Summary:     "List recording reviews for several interviews",
		Description: "Reviewer only. One request for a page of applications, instead of one per interview. Comments are always omitted here — this is for computing review-progress counts, not reading review content; use list-recording-reviews for that.",
		Tags:        []string{"Recording reviews"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listBulk)
}

type RecordingReviewOutput struct {
	Body models.InterviewRecordingReview
}

type RecordingReviewsOutput struct {
	Body []models.InterviewRecordingReview
}

type UpsertRecordingReviewInput struct {
	ID   string `path:"id" doc:"Interview ID"`
	Body struct {
		Comments *string                 `json:"comments,omitempty"`
		Rating   *models.InterviewRating `json:"rating,omitempty"`
		Submit   bool                    `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
	}
}

func (h *recordingReviewHandler) upsert(ctx context.Context, in *UpsertRecordingReviewInput) (*RecordingReviewOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Rating != nil && !in.Body.Rating.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid rating")
	}

	interview, err := h.store.GetInterviewByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// The interviewer hasn't finished yet — nothing to review, and nothing a
	// reviewer writes now would have anything to go on.
	if interview.SubmittedAt == nil {
		return nil, huma.Error409Conflict("the interviewer hasn't submitted this interview yet")
	}

	actor := currentActor(ctx)
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		assignments, err := h.store.ListInterviewReviewAssignments(ctx, interview.ApplicationID)
		if err != nil {
			return nil, storeErr(err)
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

	review, err := h.store.UpsertRecordingReview(ctx, store.RecordingReviewUpsert{
		InterviewID:  in.ID,
		ReviewerNUID: actor.NUID,
		Comments:     in.Body.Comments,
		Rating:       in.Body.Rating,
		Submit:       in.Body.Submit,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &RecordingReviewOutput{Body: review}, nil
}

type InterviewScopedInput struct {
	ID string `path:"id" doc:"Interview ID"`
}

type ListRecordingReviewsBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `interview_ids[]=…`, which binds to nothing server-side.
	InterviewIDs string `query:"interview_ids" doc:"Comma-separated interview IDs"`
}

func (h *recordingReviewHandler) listBulk(ctx context.Context, in *ListRecordingReviewsBulkInput) (*RecordingReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := splitIDs(in.InterviewIDs)
	if len(ids) == 0 {
		return &RecordingReviewsOutput{Body: []models.InterviewRecordingReview{}}, nil
	}
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many interview_ids")
	}
	items, err := h.store.ListRecordingReviewsForInterviews(ctx, ids)
	if err != nil {
		return nil, storeErr(err)
	}
	// Comments are never useful for a progress count and would otherwise need
	// a per-interview release check to redact correctly — just omit them.
	for i := range items {
		items[i].Comments = nil
	}
	return &RecordingReviewsOutput{Body: items}, nil
}

func (h *recordingReviewHandler) list(ctx context.Context, in *InterviewScopedInput) (*RecordingReviewsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	items, err := h.store.ListRecordingReviews(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}

	// The recording itself (on the interview) is always visible. Only peers'
	// written comments are blind: a plain lead sees other reviewers' comments
	// redacted until a chief releases the cycle's recording reviews for that
	// role. Chiefs and admins always see everything.
	actor := currentActor(ctx)
	if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		released, err := h.store.RecordingReviewsReleased(ctx, in.ID)
		if err != nil {
			return nil, storeErr(err)
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

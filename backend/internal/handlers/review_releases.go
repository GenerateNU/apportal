package handlers

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// reviewReleaseHandler exposes the blind-review gate: per-cycle progress for
// each review kind and a chief-only toggle to release (or hide) them for all
// reviewers at once.
type reviewReleaseHandler struct {
	store *store.Store
}

func (h *reviewReleaseHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-review-gates",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Review release status and progress for a cycle",
		Description: "Reviewer only. One entry per applicant role × review kind (written, recording): how many reviewers are assigned, how many have submitted, and whether reviews have been released to everyone.",
		Tags:        []string{"Review releases"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "set-review-release",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Release or hide a cycle's reviews for a role",
		Description: "Chief only. Releases (reveals to all reviewers) or hides a cycle's reviews of the given kind for one applicant role. May be done at any point, before all reviewers have submitted. Idempotent.",
		Tags:        []string{"Review releases"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.set)
}

// CycleScopedInput identifies an operation acting on a cycle by ID.
type CycleScopedInput struct {
	ID string `path:"id" doc:"Cycle ID"`
}

type ReviewGatesOutput struct {
	Body []models.ReviewGate
}

type ReviewGateOutput struct {
	Body models.ReviewGate
}

func (h *reviewReleaseHandler) list(ctx context.Context, in *CycleScopedInput) (*ReviewGatesOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	roles := []models.Role{models.RoleSoftwareEngineer, models.RoleSoftwareDesigner}
	kinds := []models.ReviewKind{models.ReviewKindWritten, models.ReviewKindRecording}
	gates := make([]models.ReviewGate, 0, len(roles)*len(kinds))
	for _, role := range roles {
		for _, kind := range kinds {
			gate, err := h.store.ReviewGate(ctx, in.ID, role, kind)
			if err != nil {
				return nil, storeErr(err)
			}
			gates = append(gates, gate)
		}
	}
	return &ReviewGatesOutput{Body: gates}, nil
}

type SetReviewReleaseInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role     models.Role       `json:"role" doc:"Applicant role: software_engineer or software_designer"`
		Kind     models.ReviewKind `json:"kind" doc:"Review kind: written or recording"`
		Released bool              `json:"released" doc:"True releases reviews to all reviewers; false hides them again"`
	}
}

func (h *reviewReleaseHandler) set(ctx context.Context, in *SetReviewReleaseInput) (*ReviewGateOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	if !in.Body.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("kind must be 'written' or 'recording'")
	}
	gate, err := h.store.SetReviewRelease(ctx, in.ID, in.Body.Role, in.Body.Kind, in.Body.Released, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ReviewGateOutput{Body: gate}, nil
}

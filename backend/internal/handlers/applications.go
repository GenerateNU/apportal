package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type applicationHandler struct {
	store *store.Store
}

func (h *applicationHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "create-application",
		Method:        http.MethodPost,
		Path:          "/applications",
		Summary:       "Submit an application",
		Description:   "One application per applicant, role, and cycle.",
		Tags:          []string{"Applications"},
		DefaultStatus: http.StatusCreated,
		Errors:        []int{http.StatusConflict},
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "get-application",
		Method:      http.MethodGet,
		Path:        "/applications/{id}",
		Summary:     "Get an application",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusNotFound},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "list-applications",
		Method:      http.MethodGet,
		Path:        "/applications",
		Summary:     "List applications",
		Description: "Reviewer queue; filter by cycle_id, role, and stage. Applicants may list their own by passing user_nuid.",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "update-application",
		Method:      http.MethodPatch,
		Path:        "/applications/{id}",
		Summary:     "Update an application",
		Description: "Set resume_url, availability, or advance/withdraw the stage.",
		Tags:        []string{"Applications"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-application",
		Method:        http.MethodDelete,
		Path:          "/applications/{id}",
		Summary:       "Discard a draft application",
		Description:   "Applicant only, and only while still a draft.",
		Tags:          []string{"Applications"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusNotFound},
	}, h.delete)
}

type ApplicationOutput struct {
	Body models.Application
}

type ApplicationsOutput struct {
	Body []models.Application
}

type CreateApplicationInput struct {
	Body struct {
		CycleID      string          `json:"cycle_id" minLength:"1"`
		Role         models.Role     `json:"role"`
		Availability json.RawMessage `json:"availability,omitempty"`
		ResumeURL    *string         `json:"resume_url,omitempty"`
	}
}

func (h *applicationHandler) create(ctx context.Context, in *CreateApplicationInput) (*ApplicationOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid role is required")
	}

	app, err := h.store.CreateApplication(ctx, store.ApplicationCreate{
		CycleID:      in.Body.CycleID,
		UserNUID:     actor.NUID,
		Role:         in.Body.Role,
		Availability: in.Body.Availability,
		ResumeURL:    in.Body.ResumeURL,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicationOutput{Body: app}, nil
}

type ApplicationIDInput struct {
	ID string `path:"id"`
}

func (h *applicationHandler) get(ctx context.Context, in *ApplicationIDInput) (*ApplicationOutput, error) {
	app, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// A draft is a private autosave — only its owner can fetch it directly.
	// Reject the same way as a missing row so a guessed/shared draft ID can't
	// be distinguished from one that doesn't exist.
	if app.Stage == models.StageDraft {
		actor, hasActor := middleware.ActorFrom(ctx)
		if !hasActor || actor.NUID != app.UserNUID {
			return nil, huma.Error404NotFound("not found")
		}
	}
	return &ApplicationOutput{Body: app}, nil
}

type ListApplicationsInput struct {
	CycleID    string `query:"cycle_id"`
	UserNUID   string `query:"user_nuid"`
	AssignedTo string `query:"assigned_to" doc:"Limit to applications this lead is assigned to review"`
	Role       string `query:"role"`
	Stage      string `query:"stage"`
}

func (h *applicationHandler) list(ctx context.Context, in *ListApplicationsInput) (*ApplicationsOutput, error) {
	// Applicants may fetch their own applications by scoping to their own
	// user_nuid; the unscoped reviewer queue requires a reviewer identity, and
	// a non-reviewer scoping to someone else's user_nuid is rejected outright
	// rather than silently ignored.
	actor, hasActor := middleware.ActorFrom(ctx)
	isReviewer := hasActor && actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin)
	if in.UserNUID == "" {
		if err := requireReviewer(ctx); err != nil {
			return nil, err
		}
	} else if !isReviewer && (!hasActor || actor.NUID != in.UserNUID) {
		return nil, huma.Error403Forbidden("cannot list another user's applications")
	}
	filter := store.ApplicationFilter{
		CycleID:    in.CycleID,
		UserNUID:   in.UserNUID,
		AssignedTo: in.AssignedTo,
		// Only a user listing their own applications by their own identity
		// ever sees their own draft — the reviewer queue and lookups of
		// someone else's user_nuid never do.
		IncludeDraft: in.UserNUID != "" && hasActor && actor.NUID == in.UserNUID,
	}
	if in.Role != "" {
		parsed := models.Role(in.Role)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role")
		}
		filter.Role = &parsed
	}
	if in.Stage != "" {
		parsed := models.ApplicationStage(in.Stage)
		if !parsed.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid stage")
		}
		filter.Stage = &parsed
	}

	apps, err := h.store.ListApplications(ctx, filter)
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicationsOutput{Body: apps}, nil
}

type UpdateApplicationInput struct {
	ID   string `path:"id"`
	Body struct {
		Stage        *models.ApplicationStage `json:"stage,omitempty"`
		Availability json.RawMessage          `json:"availability,omitempty"`
		ResumeURL    *string                  `json:"resume_url,omitempty"`
	}
}

func (h *applicationHandler) update(ctx context.Context, in *UpdateApplicationInput) (*ApplicationOutput, error) {
	if in.Body.Stage != nil && !in.Body.Stage.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid stage")
	}

	actor, hasActor := middleware.ActorFrom(ctx)
	if !hasActor || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	current, err := h.store.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}

	isOwner := actor.NUID == current.UserNUID
	isReviewer := actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin)
	if !isOwner && !isReviewer {
		return nil, huma.Error403Forbidden("cannot update another applicant's application")
	}

	// Applicants self-servicing their own application (as opposed to a
	// reviewer advancing it through the pipeline) may only flip their own
	// draft to submitted, and only once it's actually complete — never any
	// other stage, and never someone else's application.
	if isOwner && !isReviewer && in.Body.Stage != nil {
		if current.Stage != models.StageDraft || *in.Body.Stage != models.StageSubmitted {
			return nil, huma.Error403Forbidden("applicants may only submit their own draft")
		}
		if err := h.requireComplete(ctx, current); err != nil {
			return nil, err
		}
	}

	app, err := h.store.UpdateApplication(ctx, in.ID, store.ApplicationUpdate{
		Stage:        in.Body.Stage,
		Availability: in.Body.Availability,
		ResumeURL:    in.Body.ResumeURL,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &ApplicationOutput{Body: app}, nil
}

// requireComplete checks, server-side, that an application is actually ready
// to submit: every required question answered, and a code submission on
// file if the role has a challenge. This backs the draft->submitted
// transition so completeness isn't only enforced by the client.
func (h *applicationHandler) requireComplete(ctx context.Context, app models.Application) error {
	questions, err := h.store.ListQuestions(ctx, app.CycleID, &app.Role)
	if err != nil {
		return storeErr(err)
	}
	answers, err := h.store.ListAnswers(ctx, app.ID)
	if err != nil {
		return storeErr(err)
	}
	answered := make(map[string]bool, len(answers))
	for _, a := range answers {
		hasText := a.AnswerText != nil && strings.TrimSpace(*a.AnswerText) != ""
		var opts []string
		hasOptions := len(a.AnswerOptions) > 0 &&
			json.Unmarshal(a.AnswerOptions, &opts) == nil && len(opts) > 0
		if hasText || hasOptions {
			answered[a.QuestionID] = true
		}
	}
	for _, q := range questions {
		if q.IsRequired && !answered[q.ID] {
			return huma.Error422UnprocessableEntity("all required questions must be answered before submitting")
		}
	}

	challenges, err := h.store.ListChallenges(ctx, app.CycleID, &app.Role)
	if err != nil {
		return storeErr(err)
	}
	if len(challenges) > 0 {
		submissions, err := h.store.ListCodeSubmissions(ctx, app.ID)
		if err != nil {
			return storeErr(err)
		}
		if len(submissions) == 0 {
			return huma.Error422UnprocessableEntity("a code challenge submission is required before submitting")
		}
	}
	return nil
}

func (h *applicationHandler) delete(ctx context.Context, in *ApplicationIDInput) (*struct{}, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	if err := h.store.DeleteDraftApplication(ctx, in.ID, actor.NUID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

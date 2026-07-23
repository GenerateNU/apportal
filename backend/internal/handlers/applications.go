package handlers

import (
	"context"
	"encoding/json"
	"net/http"

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
		Errors:      []int{http.StatusNotFound},
	}, h.update)
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

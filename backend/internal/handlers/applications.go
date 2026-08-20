package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

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
		Errors:        []int{http.StatusConflict, http.StatusForbidden},
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
		Description: "Reviewer queue; filter by cycle_id, role, stage, answer_filters, and rating_filters. Applicants may list their own by passing user_nuid.",
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

// ApplicationsOutput is an envelope rather than a bare array because paging
// happens in SQL: a page of rows says nothing about how many matched, and the
// stage tabs need their own counts. Unpaged callers read `applications` and
// ignore the rest.
type ApplicationsOutput struct {
	Body struct {
		Applications []models.ApplicationSummary `json:"applications"`
		// Total is every row matching the filter, not just this page.
		Total int `json:"total"`
		// StageCounts is the same match broken down by stage, ignoring any
		// stage filter, so each tab can show a live count.
		StageCounts map[string]int `json:"stage_counts"`
	}
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

	tpl, err := h.store.GetOrCreateApplicationTemplate(ctx, in.Body.CycleID, in.Body.Role)
	if err != nil {
		return nil, storeErr(err)
	}
	if deadlinePassed(tpl) {
		return nil, huma.Error403Forbidden("the application deadline has passed")
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
	// InterviewerNUID is the interview-side counterpart of AssignedTo: the
	// reviewer's own "interviews assigned to me" queue.
	InterviewerNUID string `query:"interviewer_nuid" doc:"Limit to applications this reviewer is assigned to interview"`
	// RecordingReviewerNUID is the recording-review counterpart of
	// InterviewerNUID: the lead's own "interviews assigned to me to review" queue.
	RecordingReviewerNUID string `query:"recording_reviewer_nuid" doc:"Limit to applications this lead is assigned to review the interview recording of"`
	Role                  string `query:"role"`
	Stage                 string `query:"stage"`
	// AnswerFilters is a JSON-encoded []AnswerFilterInput rather than a
	// structured param because huma can only bind primitives from a query
	// string — a []AnswerFilterInput field silently binds nothing (or panics,
	// depending on how the client serializes it).
	AnswerFilters string `query:"answer_filters" doc:"JSON array of answer filters, e.g. [{\"question_id\":\"…\",\"question_type\":\"checkbox\",\"values\":[\"Yes\"]}]. Values may be a string or an array of strings; a filter matches any of them, and separate filters are AND'd."`
	// RatingFilters is a comma-separated list of interview ratings to filter by,
	// e.g. "must_hire,great". Applications match if their interview has any of
	// these ratings.
	RatingFilters string `query:"rating_filters" doc:"Comma-separated list of interview ratings, e.g. \"must_hire,great\""`
	Search        string `query:"search" doc:"Case-insensitive substring match on the applicant's name, NUID, or email"`
	Limit         int    `query:"limit" doc:"Max results per page; omit (or 0) to return every match" minimum:"0" maximum:"200"`
	Offset        int    `query:"offset" doc:"Number of results to skip" minimum:"0"`
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
	answerFilters, err := parseAnswerFilters(in.AnswerFilters)
	if err != nil {
		return nil, err
	}
	ratingFilters, err := parseRatingFilters(in.RatingFilters)
	if err != nil {
		return nil, err
	}

	filter := store.ApplicationFilter{
		CycleID:               in.CycleID,
		UserNUID:              in.UserNUID,
		AssignedTo:            in.AssignedTo,
		InterviewerNUID:       in.InterviewerNUID,
		RecordingReviewerNUID: in.RecordingReviewerNUID,
		AnswerFilters:         answerFilters,
		InterviewRatings:      ratingFilters,
		Search:                in.Search,
		Offset:                in.Offset,
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

	if in.Limit > 0 {
		filter.Limit = &in.Limit
	}

	// The totals cost a full scan each and are invariant for a given filter, so
	// only the first page pays for them; later pages reuse what it returned.
	page, err := h.store.ListApplicationsPage(ctx, filter, in.Offset == 0)
	if err != nil {
		return nil, storeErr(err)
	}
	out := &ApplicationsOutput{}
	out.Body.Applications = page.Items
	out.Body.Total = page.Total
	out.Body.StageCounts = make(map[string]int, len(page.StageCounts))
	for stage, n := range page.StageCounts {
		out.Body.StageCounts[string(stage)] = n
	}
	return out, nil
}

// parseRatingFilters decodes a comma-separated list of interview ratings.
func parseRatingFilters(raw string) ([]models.InterviewRating, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ratings := make([]models.InterviewRating, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		rating := models.InterviewRating(part)
		if !rating.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid rating in rating_filters: " + part)
		}
		ratings = append(ratings, rating)
	}
	return ratings, nil
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

	// A draft is frozen once its template's deadline has passed — no autosave,
	// no submit, no reviewer-initiated stage change either. This is a hard
	// stop enforced regardless of who's making the request, unlike the
	// owner-only rules below.
	if current.Stage == models.StageDraft {
		tpl, err := h.store.GetOrCreateApplicationTemplate(ctx, current.CycleID, current.Role)
		if err != nil {
			return nil, storeErr(err)
		}
		if deadlinePassed(tpl) {
			return nil, huma.Error403Forbidden("the application deadline has passed")
		}
	}

	markSubmitted := false
	if in.Body.Stage != nil {
		// Applicants self-servicing their own application (as opposed to a
		// reviewer advancing it through the pipeline) may only flip their own
		// draft to submitted — never any other stage, and never someone
		// else's application.
		if isOwner && !isReviewer {
			if current.Stage != models.StageDraft || *in.Body.Stage != models.StageSubmitted {
				return nil, huma.Error403Forbidden("applicants may only submit their own draft")
			}
		} else if !actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
			// Every other stage change — a lead moving an application through
			// the pipeline, or an owner who also happens to hold a reviewer
			// role — is a chief decision (advance to interview, reject,
			// etc.), not something a plain lead reviewer can do just because
			// they can view the application.
			return nil, huma.Error403Forbidden("chief role required to change an application's stage")
		}

		// The draft->submitted completeness check applies regardless of who
		// initiates it, so a reviewer/admin (or an owner who also holds a
		// reviewer role) can't move a still-incomplete draft to submitted on
		// an applicant's behalf and bypass the required-answers validation.
		if current.Stage == models.StageDraft && *in.Body.Stage == models.StageSubmitted {
			if err := h.requireComplete(ctx, current); err != nil {
				return nil, err
			}
			markSubmitted = true
		}
	}

	app, err := h.store.UpdateApplication(ctx, in.ID, store.ApplicationUpdate{
		Stage:         in.Body.Stage,
		Availability:  in.Body.Availability,
		ResumeURL:     in.Body.ResumeURL,
		MarkSubmitted: markSubmitted,
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
		hasFilePath := a.AnswerFilePath != nil && strings.TrimSpace(*a.AnswerFilePath) != ""
		var opts []string
		hasOptions := len(a.AnswerOptions) > 0 &&
			json.Unmarshal(a.AnswerOptions, &opts) == nil && len(opts) > 0
		if hasText || hasFilePath || hasOptions {
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

// deadlinePassed reports whether a template's closing time has passed. A nil
// ClosesAt means no deadline was ever set, so it never blocks.
func deadlinePassed(tpl models.ApplicationTemplate) bool {
	return tpl.ClosesAt != nil && time.Now().After(*tpl.ClosesAt)
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

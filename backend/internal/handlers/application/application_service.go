package application

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/handlers/applicationtemplate"
	"github.com/GenerateNU/apportal/backend/internal/handlers/challenge"
	"github.com/GenerateNU/apportal/backend/internal/handlers/codesubmission"
	"github.com/GenerateNU/apportal/backend/internal/handlers/question"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type applicationService struct {
	applicationDB         *ApplicationDB
	applicationTemplateDB *applicationtemplate.ApplicationTemplateDB
	challengeDB           *challenge.ChallengeDB
	codeSubmissionDB      *codesubmission.CodeSubmissionDB
	questionDB            *question.QuestionDB
}

func (s *applicationService) create(ctx context.Context, in *CreateApplicationInput) (*ApplicationOutput, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("valid role is required")
	}

	tpl, err := s.applicationTemplateDB.GetOrCreateApplicationTemplate(ctx, in.Body.CycleID, in.Body.Role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if deadlinePassed(tpl) {
		return nil, huma.Error403Forbidden("the application deadline has passed")
	}

	app, err := s.applicationDB.CreateApplication(ctx, ApplicationCreate{
		CycleID:      in.Body.CycleID,
		UserNUID:     actor.NUID,
		Role:         in.Body.Role,
		Availability: in.Body.Availability,
		ResumeURL:    in.Body.ResumeURL,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationOutput{Body: app}, nil
}

func (s *applicationService) get(ctx context.Context, in *ApplicationIDInput) (*ApplicationOutput, error) {
	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
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

func (s *applicationService) list(ctx context.Context, in *ListApplicationsInput) (*ApplicationsOutput, error) {
	// Applicants may fetch their own applications by scoping to their own
	// user_nuid; the unscoped reviewer queue requires a reviewer identity, and
	// a non-reviewer scoping to someone else's user_nuid is rejected outright
	// rather than silently ignored.
	actor, hasActor := middleware.ActorFrom(ctx)
	isReviewer := hasActor && actor.HasAnyRole(models.UserRoleLead, models.UserRoleChief, models.UserRoleAdmin)
	if in.UserNUID == "" {
		if err := utils.RequireReviewer(ctx); err != nil {
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
	stages, err := parseStages(in.Stages)
	if err != nil {
		return nil, err
	}
	roles, err := parseRoles(in.Roles)
	if err != nil {
		return nil, err
	}
	returner, err := parseReturner(in.Returner)
	if err != nil {
		return nil, err
	}

	filter := ApplicationFilter{
		CycleID:               in.CycleID,
		UserNUID:              in.UserNUID,
		AssignedTo:            in.AssignedTo,
		InterviewerNUID:       in.InterviewerNUID,
		RecordingReviewerNUID: in.RecordingReviewerNUID,
		AnswerFilters:         answerFilters,
		InterviewRatings:      ratingFilters,
		Roles:                 roles,
		Stages:                stages,
		Returner:              returner,
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
	page, err := s.applicationDB.ListApplicationsPage(ctx, filter, in.Offset == 0)
	if err != nil {
		return nil, utils.StoreErr(err)
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

// parseReturner decodes the returner filter; empty means "don't filter".
func parseReturner(raw string) (*bool, error) {
	switch strings.TrimSpace(raw) {
	case "":
		return nil, nil
	case "true":
		v := true
		return &v, nil
	case "false":
		v := false
		return &v, nil
	default:
		return nil, huma.Error422UnprocessableEntity("invalid returner: " + raw)
	}
}

// parseRoles decodes a comma-separated list of applicant roles.
func parseRoles(raw string) ([]models.Role, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	roles := make([]models.Role, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		role := models.Role(part)
		if !role.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid role in roles: " + part)
		}
		roles = append(roles, role)
	}
	return roles, nil
}

// parseStages decodes a comma-separated list of application stages.
func parseStages(raw string) ([]models.ApplicationStage, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	stages := make([]models.ApplicationStage, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		stage := models.ApplicationStage(part)
		if !stage.Valid() {
			return nil, huma.Error422UnprocessableEntity("invalid stage in stages: " + part)
		}
		stages = append(stages, stage)
	}
	return stages, nil
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

func (s *applicationService) update(ctx context.Context, in *UpdateApplicationInput) (*ApplicationOutput, error) {
	if in.Body.Stage != nil && !in.Body.Stage.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid stage")
	}

	actor, hasActor := middleware.ActorFrom(ctx)
	if !hasActor || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	current, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
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
		tpl, err := s.applicationTemplateDB.GetOrCreateApplicationTemplate(ctx, current.CycleID, current.Role)
		if err != nil {
			return nil, utils.StoreErr(err)
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
			if err := s.requireComplete(ctx, current); err != nil {
				return nil, err
			}
			markSubmitted = true
		}
	}

	app, err := s.applicationDB.UpdateApplication(ctx, in.ID, ApplicationUpdate{
		Stage:         in.Body.Stage,
		Availability:  in.Body.Availability,
		ResumeURL:     in.Body.ResumeURL,
		MarkSubmitted: markSubmitted,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &ApplicationOutput{Body: app}, nil
}

// requireComplete checks, server-side, that an application is actually ready
// to submit: every required question answered, and a code submission on
// file if the role has a challenge. This backs the draft->submitted
// transition so completeness isn't only enforced by the client.
func (s *applicationService) requireComplete(ctx context.Context, app models.Application) error {
	questions, err := s.questionDB.ListQuestions(ctx, app.CycleID, &app.Role)
	if err != nil {
		return utils.StoreErr(err)
	}
	answers, err := s.applicationDB.ListAnswers(ctx, app.ID)
	if err != nil {
		return utils.StoreErr(err)
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

	challenges, err := s.challengeDB.ListChallenges(ctx, app.CycleID, &app.Role)
	if err != nil {
		return utils.StoreErr(err)
	}
	if len(challenges) > 0 {
		submissions, err := s.codeSubmissionDB.ListCodeSubmissions(ctx, app.ID)
		if err != nil {
			return utils.StoreErr(err)
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

func (s *applicationService) delete(ctx context.Context, in *ApplicationIDInput) (*struct{}, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return nil, huma.Error401Unauthorized("authentication required")
	}
	if err := s.applicationDB.DeleteDraftApplication(ctx, in.ID, actor.NUID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

type interviewScriptHandler struct {
	store *store.Store
}

func (h *interviewScriptHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-interview-script",
		Method:      http.MethodGet,
		Path:        "/interview-script",
		Summary:     "Get the interview script",
		Description: "Reviewer only. One global script, not scoped to a cycle.",
		Tags:        []string{"Interview script"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "update-interview-script",
		Method:      http.MethodPut,
		Path:        "/interview-script",
		Summary:     "Replace the interview script",
		Description: "Chief only. Replaces the whole script — there's no partial update.",
		Tags:        []string{"Interview script"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.update)
}

type InterviewScriptOutput struct {
	Body models.InterviewScript
}

type GetInterviewScriptInput struct{}

func (h *interviewScriptHandler) get(ctx context.Context, _ *GetInterviewScriptInput) (*InterviewScriptOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	script, err := h.store.GetInterviewScript(ctx)
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewScriptOutput{Body: script}, nil
}

type UpdateInterviewScriptInput struct {
	Body struct {
		IntroSpeech            string          `json:"intro_speech" minLength:"1"`
		RecordingReminder      string          `json:"recording_reminder" minLength:"1"`
		Questions              json.RawMessage `json:"questions"`
		ClosingNote            string          `json:"closing_note" minLength:"1"`
		ChallengeIntro         string          `json:"challenge_intro" minLength:"1"`
		ChallengeTracks        json.RawMessage `json:"challenge_tracks"`
		PostInterviewChecklist json.RawMessage `json:"post_interview_checklist"`
	}
}

func (h *interviewScriptHandler) update(ctx context.Context, in *UpdateInterviewScriptInput) (*InterviewScriptOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if !json.Valid(in.Body.Questions) {
		return nil, huma.Error422UnprocessableEntity("questions must be valid JSON")
	}
	if !json.Valid(in.Body.ChallengeTracks) {
		return nil, huma.Error422UnprocessableEntity("challenge_tracks must be valid JSON")
	}
	if !json.Valid(in.Body.PostInterviewChecklist) {
		return nil, huma.Error422UnprocessableEntity("post_interview_checklist must be valid JSON")
	}

	script, err := h.store.UpdateInterviewScript(ctx, store.InterviewScriptUpdate{
		IntroSpeech:            in.Body.IntroSpeech,
		RecordingReminder:      in.Body.RecordingReminder,
		Questions:              in.Body.Questions,
		ClosingNote:            in.Body.ClosingNote,
		ChallengeIntro:         in.Body.ChallengeIntro,
		ChallengeTracks:        in.Body.ChallengeTracks,
		PostInterviewChecklist: in.Body.PostInterviewChecklist,
		UpdatedBy:              currentActor(ctx).NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &InterviewScriptOutput{Body: script}, nil
}

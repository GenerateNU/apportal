package interview

import (
	"context"
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

type interviewScriptService struct {
	interviewDB *InterviewDB
}

func (s *interviewScriptService) get(ctx context.Context, in *GetInterviewScriptInput) (*InterviewScriptOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := utils.ParseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	script, err := s.interviewDB.GetOrCreateInterviewScript(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewScriptOutput{Body: script}, nil
}

func (s *interviewScriptService) update(ctx context.Context, in *UpdateInterviewScriptInput) (*InterviewScriptOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	role, err := utils.ParseTemplateRole(in.Role)
	if err != nil {
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

	script, err := s.interviewDB.UpdateInterviewScript(ctx, in.ID, role, InterviewScriptUpdate{
		IntroSpeech:            in.Body.IntroSpeech,
		RecordingReminder:      in.Body.RecordingReminder,
		Questions:              in.Body.Questions,
		ClosingNote:            in.Body.ClosingNote,
		ChallengeIntro:         in.Body.ChallengeIntro,
		ChallengeTracks:        in.Body.ChallengeTracks,
		PostInterviewChecklist: in.Body.PostInterviewChecklist,
		UpdatedBy:              utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &InterviewScriptOutput{Body: script}, nil
}

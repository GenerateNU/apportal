package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// InterviewScriptUpdate carries a full replace of the script — chiefs edit it
// as one form, so there's no partial-field update to support.
type InterviewScriptUpdate struct {
	IntroSpeech            string
	RecordingReminder      string
	Questions              json.RawMessage
	ClosingNote            string
	ChallengeIntro         string
	ChallengeTracks        json.RawMessage
	PostInterviewChecklist json.RawMessage
	UpdatedBy              string
}

const interviewScriptColumns = `intro_speech, recording_reminder, questions, closing_note, challenge_intro, challenge_tracks, post_interview_checklist, updated_at, updated_by`

// GetInterviewScript fetches the single global script row, seeded by
// migration — there's always exactly one, so no ErrNotFound case here.
func (s *Store) GetInterviewScript(ctx context.Context) (models.InterviewScript, error) {
	const q = `SELECT ` + interviewScriptColumns + ` FROM interview_script WHERE id`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return models.InterviewScript{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
}

// UpdateInterviewScript replaces the whole script. Chief-only at the handler
// layer.
func (s *Store) UpdateInterviewScript(ctx context.Context, in InterviewScriptUpdate) (models.InterviewScript, error) {
	const q = `
		UPDATE interview_script SET
			intro_speech = $1,
			recording_reminder = $2,
			questions = $3,
			closing_note = $4,
			challenge_intro = $5,
			challenge_tracks = $6,
			post_interview_checklist = $7,
			updated_at = NOW(),
			updated_by = $8
		WHERE id
		RETURNING ` + interviewScriptColumns
	rows, err := s.db.Query(ctx, q,
		in.IntroSpeech, in.RecordingReminder, jsonArg(in.Questions), in.ClosingNote,
		in.ChallengeIntro, jsonArg(in.ChallengeTracks),
		jsonArg(in.PostInterviewChecklist), in.UpdatedBy)
	if err != nil {
		return models.InterviewScript{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
}

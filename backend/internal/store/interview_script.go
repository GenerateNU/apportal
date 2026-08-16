package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// InterviewScriptUpdate carries a full replace of one (cycle, role) script —
// chiefs edit it as one form, so there's no partial-field update to support.
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

const interviewScriptColumns = `id, cycle_id, application_role, intro_speech, recording_reminder, questions, closing_note, challenge_intro, challenge_tracks, post_interview_checklist, created_at, updated_at, updated_by`

// defaultIntroSpeech etc. seed a new (cycle, role) script before a chief has
// customized it — bracketed placeholders stand in for cycle-specific details
// (dates, weekly hours) a chief fills in once the cycle's plans are set.
const defaultIntroSpeech = `I will try to keep this part short, but I am just going to run through the job description, some basic requirements, and some information about the overall hiring process before we get started to make sure we're on the same page before we jump into the interview.

Just to clarify, we are here today for an interview for the [role] role in Generate that starts in [cycle start date] and extends through [cycle end date], with a weekly time commitment of roughly [X] hours per week. Does that still sound like something you are willing and able to commit to?

As for the hiring process, we'll be conducting interviews until roughly [interview deadline], at which point I will be working with the rest of the team to make decisions, and acceptance emails should go out at some point before the [semester] starts. Does that all sound ok?

As a reminder, this position is only for students that will be in Boston for the entirety of the [semester] semester. If this is not your case, sadly we will not be able to continue with your candidacy. Can you confirm you will be in Boston for the entire semester (not counting breaks and weekends)?

Now, for the structure of the interview I am going to be asking a few questions that directly relate to the role. The goal of these is absolutely not to put you on the spot, so I highly encourage you to take as much time as needed to prepare your response, and let me know when you're ready. After I ask these questions I will leave plenty of time at the end of the interview for you to ask me questions, whether they be about the role, the organization, or literally anything else.

I expect this interview to take about 30 minutes, but it's important to me that I get a holistic view of your application, so if we go over by any amount that is totally fine.

And just so you know, I will be taking notes as fast as possible during the interview, so if I am looking down at my keys or am on mute or there's an awkward pause after your response just know that's what I'm up to, not anything else.

Do you have any questions about the interview or hiring process?`

const defaultRecordingReminder = `Hit record (choose cloud recording) before moving on to the questions below.`

const defaultClosingNote = `Thank you so much for the thorough answers! That's all I have, so now I'd like to open the floor for you to rapid fire any questions you may have for me.`

const defaultChallengeIntro = `Ask the applicant to pull up their code and share their screen. Pick and choose from the questions below rather than asking every one — keep an eye on time.`

var defaultQuestions = json.RawMessage(`[
	{"prompt": "Tell us about yourself.", "followUps": ["What drew you to this role in particular?", "How did that background shape what you're looking for here?"]},
	{"prompt": "Why do you want to join Generate?", "followUps": ["What about our specific projects or mission stood out to you?", "Is there anything about the program structure you're still unsure about?"]},
	{"prompt": "Describe a good or bad experience you had working on a team. Why was that experience positive/negative?", "followUps": ["What would you have done differently, looking back?", "How did you address the situation in the moment?", "What did that experience teach you about your own working style?"]},
	{"prompt": "Tell me about a project you worked on in as much technical detail as possible. How did you solve the problems from that project?", "followUps": ["What was specifically your contribution versus the rest of the team's?", "What tradeoffs did you weigh when choosing your approach?", "How did you test or validate that it actually worked?", "What would you do differently if you started it again today?"]},
	{"prompt": "Tell us about a time when you challenged yourself. What was the outcome? This can be from a technical or non-technical experience.", "followUps": ["What made it feel like a real stretch at the time?", "What did you do in the moment you got stuck?", "How has that changed how you approach hard problems now?"]},
	{"prompt": "What do you think is the most important quality of an effective engineer?", "followUps": ["Can you give an example of a time you (or someone else) showed that quality?", "What tends to go wrong on a team when that quality is missing?"]},
	{"prompt": "Is there anything else you'd like to share with us?"}
]`)

var defaultChallengeTracks = json.RawMessage(`{
	"backend": {"label": "Backend", "followUps": [
		"Which challenge did you choose, and why this one in particular?",
		"Walk me through your solution, as you do that, explain why you made the choices you made? How did you approach the challenge?",
		"If there was anything new you had to learn, how did you approach teaching yourself?",
		"What was the most challenging aspect of the challenge — how did you overcome it?",
		"Now that you look at it again, are there ways you could improve your solution?",
		"How did you leverage the provided materials to make the development process easier?"
	]},
	"frontend": {"label": "Frontend", "followUps": [
		"Which challenge did you choose, and why this one in particular?",
		"Walk me through your solution, as you do that, explain why you made the choices you made? How did you approach the challenge?",
		"If there was anything new you had to learn, how did you approach teaching yourself?",
		"What was the most challenging aspect of the challenge — how did you overcome it?",
		"Now that you look at it again, are there ways you could improve your solution?",
		"How did you leverage the provided materials to make the development process easier?"
	]}
}`)

var defaultPostInterviewChecklist = json.RawMessage(`[
	"Stop the recording.",
	"In the Interview section above, summarize your thoughts in Comments.",
	"Set a Rating for this applicant.",
	"Add the recording link (and notes link, if you took any) before submitting.",
	"Submit the interview — this unlocks the recording reviewer's review."
]`)

// GetOrCreateInterviewScript fetches the (cycle, role) script, creating one
// with default content on first access so callers never have to handle a
// missing row — mirrors GetOrCreateApplicationTemplate.
func (s *Store) GetOrCreateInterviewScript(ctx context.Context, cycleID string, role models.Role) (models.InterviewScript, error) {
	const selectQ = `SELECT ` + interviewScriptColumns + ` FROM interview_script WHERE cycle_id = $1 AND application_role = $2`

	rows, err := s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.InterviewScript{}, err
	}
	existing, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.InterviewScript{}, err
	}

	const insertQ = `
		INSERT INTO interview_script (cycle_id, application_role, intro_speech, recording_reminder, questions, closing_note, challenge_intro, challenge_tracks, post_interview_checklist)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (cycle_id, application_role) DO NOTHING
		RETURNING ` + interviewScriptColumns
	rows, err = s.db.Query(ctx, insertQ, cycleID, role, defaultIntroSpeech, defaultRecordingReminder,
		jsonArg(defaultQuestions), defaultClosingNote, defaultChallengeIntro,
		jsonArg(defaultChallengeTracks), jsonArg(defaultPostInterviewChecklist))
	if err != nil {
		return models.InterviewScript{}, err
	}
	created, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
	if err == nil {
		return created, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.InterviewScript{}, err
	}

	// Lost a race with a concurrent create; fetch what the other writer inserted.
	rows, err = s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return models.InterviewScript{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
}

// UpdateInterviewScript replaces a (cycle, role) script's content. Chief-only
// at the handler layer.
func (s *Store) UpdateInterviewScript(ctx context.Context, cycleID string, role models.Role, in InterviewScriptUpdate) (models.InterviewScript, error) {
	const q = `
		UPDATE interview_script SET
			intro_speech = $3,
			recording_reminder = $4,
			questions = $5,
			closing_note = $6,
			challenge_intro = $7,
			challenge_tracks = $8,
			post_interview_checklist = $9,
			updated_at = NOW(),
			updated_by = $10
		WHERE cycle_id = $1 AND application_role = $2
		RETURNING ` + interviewScriptColumns
	rows, err := s.db.Query(ctx, q, cycleID, role,
		in.IntroSpeech, in.RecordingReminder, jsonArg(in.Questions), in.ClosingNote,
		in.ChallengeIntro, jsonArg(in.ChallengeTracks), jsonArg(in.PostInterviewChecklist), in.UpdatedBy)
	if err != nil {
		return models.InterviewScript{}, err
	}
	script, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewScript])
	if errors.Is(err, pgx.ErrNoRows) {
		return script, ErrNotFound
	}
	return script, err
}

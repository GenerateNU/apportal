package interview

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type InterviewDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewInterviewDB(db *gorm.DB) *InterviewDB {
	return &InterviewDB{db: db, users: user.NewUserDB(db)}
}

// InterviewUpsert carries the interviewer's write-up. Nil fields keep their
// stored value; Submit stamps submitted_at.
type InterviewUpsert struct {
	ApplicationID   string
	InterviewerNUID string
	ScheduledAt     *time.Time
	ConductedAt     *time.Time
	RecordingURL    *string
	NotesURL        *string
	Comments        *string
	Rating          *models.InterviewRating
	Submit          bool
}

// InterviewScriptUpdate replaces a whole (cycle, role) script; chiefs edit it
// as one form.
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

// keepIfNull keeps the stored value when the upsert supplies NULL.
func keepIfNull(table string, columns ...string) []clause.Assignment {
	set := make([]clause.Assignment, len(columns))
	for i, col := range columns {
		set[i] = clause.Assignment{
			Column: clause.Column{Name: col},
			Value:  gorm.Expr("COALESCE(EXCLUDED." + col + ", " + table + "." + col + ")"),
		}
	}
	return set
}

// UpsertInterview creates or updates an application's single interview.
// Supplied fields overwrite; omitted ones are kept.
func (i *InterviewDB) UpsertInterview(ctx context.Context, in InterviewUpsert) (models.Interview, error) {
	interview := models.Interview{
		ApplicationID:   in.ApplicationID,
		InterviewerNUID: in.InterviewerNUID,
		ScheduledAt:     in.ScheduledAt,
		ConductedAt:     in.ConductedAt,
		RecordingURL:    in.RecordingURL,
		NotesURL:        in.NotesURL,
		Comments:        in.Comments,
		Rating:          in.Rating,
	}
	set := append(clause.AssignmentColumns([]string{"interviewer_nuid"}),
		keepIfNull("interviews", "scheduled_at", "conducted_at", "recording_url", "notes_url", "comments", "rating")...)
	set = append(set, clause.Assignment{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")})

	err := i.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Select("application_id", "interviewer_nuid", "scheduled_at", "conducted_at",
			"recording_url", "notes_url", "comments", "rating").
			Clauses(
				clause.OnConflict{Columns: []clause.Column{{Name: "application_id"}}, DoUpdates: set},
				clause.Returning{},
			).
			Create(&interview).Error
		if err != nil || !in.Submit {
			return err
		}
		return tx.Model(&interview).Clauses(clause.Returning{}).UpdateColumn("submitted_at", gorm.Expr("NOW()")).Error
	})
	return interview, err
}

func (i *InterviewDB) GetInterview(ctx context.Context, applicationID string) (models.Interview, error) {
	var interview models.Interview
	err := i.db.WithContext(ctx).Where("application_id = ?", applicationID).Take(&interview).Error
	return interview, utils.DBErr(err)
}

// ListInterviewsForApplications is the batch form of GetInterview, for pages
// of applications.
func (i *InterviewDB) ListInterviewsForApplications(ctx context.Context, applicationIDs []string) ([]models.Interview, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	interviews := []models.Interview{}
	err := i.db.WithContext(ctx).Where("application_id IN ?", applicationIDs).Order("application_id").Find(&interviews).Error
	return interviews, err
}

// GetInterviewByID fetches an interview by its own ID, for recording reviews.
func (i *InterviewDB) GetInterviewByID(ctx context.Context, id string) (models.Interview, error) {
	var interview models.Interview
	err := i.db.WithContext(ctx).Where("id = ?", id).Take(&interview).Error
	return interview, utils.DBErr(err)
}

// CreateInterviewComment adds a comment; any reviewer may leave any number.
func (i *InterviewDB) CreateInterviewComment(ctx context.Context, applicationID, authorNUID, body string) (models.InterviewCommentDetail, error) {
	comment := models.InterviewComment{ApplicationID: applicationID, AuthorNUID: authorNUID, Body: body}
	if err := utils.Insert(i.db.WithContext(ctx), &comment, "application_id", "author_nuid", "body"); err != nil {
		return models.InterviewCommentDetail{}, err
	}
	return i.commentDetail(ctx, comment)
}

// UpdateInterviewComment edits the author's own comment. ErrNotFound covers
// both "doesn't exist" and "isn't yours".
func (i *InterviewDB) UpdateInterviewComment(ctx context.Context, commentID, authorNUID, body string) (models.InterviewCommentDetail, error) {
	comment, err := utils.UpdateReturning[models.InterviewComment](i.db.WithContext(ctx),
		map[string]any{"body": body, "updated_at": gorm.Expr("NOW()")}, "id = ? AND author_nuid = ?", commentID, authorNUID)
	if err != nil {
		return models.InterviewCommentDetail{}, err
	}
	return i.commentDetail(ctx, comment)
}

func (i *InterviewDB) commentDetail(ctx context.Context, comment models.InterviewComment) (models.InterviewCommentDetail, error) {
	names, err := i.users.NamesByNUIDs(ctx, []string{comment.AuthorNUID})
	return models.InterviewCommentDetail{InterviewComment: comment, AuthorName: names[comment.AuthorNUID]}, err
}

// ListInterviewComments returns an application's comments, oldest first.
func (i *InterviewDB) ListInterviewComments(ctx context.Context, applicationID string) ([]models.InterviewCommentDetail, error) {
	var comments []models.InterviewComment
	err := i.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("created_at").Find(&comments).Error
	if err != nil {
		return nil, err
	}
	nuids := make([]string, len(comments))
	for n, c := range comments {
		nuids[n] = c.AuthorNUID
	}
	names, err := i.users.NamesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}
	details := make([]models.InterviewCommentDetail, len(comments))
	for n, c := range comments {
		details[n] = models.InterviewCommentDetail{InterviewComment: c, AuthorName: names[c.AuthorNUID]}
	}
	return details, nil
}

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

// GetOrCreateInterviewScript fetches the (cycle, role) script, creating it
// with default content on first access so callers never see a missing row.
func (i *InterviewDB) GetOrCreateInterviewScript(ctx context.Context, cycleID string, role models.Role) (models.InterviewScript, error) {
	db := i.db.WithContext(ctx)
	var script models.InterviewScript
	err := db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&script).Error
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return script, err
	}

	script = models.InterviewScript{
		CycleID:                cycleID,
		ApplicationRole:        role,
		IntroSpeech:            defaultIntroSpeech,
		RecordingReminder:      defaultRecordingReminder,
		Questions:              defaultQuestions,
		ClosingNote:            defaultClosingNote,
		ChallengeIntro:         defaultChallengeIntro,
		ChallengeTracks:        defaultChallengeTracks,
		PostInterviewChecklist: defaultPostInterviewChecklist,
	}
	res := db.Select("cycle_id", "application_role", "intro_speech", "recording_reminder", "questions",
		"closing_note", "challenge_intro", "challenge_tracks", "post_interview_checklist").
		Clauses(clause.OnConflict{DoNothing: true}, clause.Returning{}).
		Create(&script)
	if res.Error != nil || res.RowsAffected > 0 {
		return script, res.Error
	}

	// Lost a race with a concurrent create; read what the other writer inserted.
	script = models.InterviewScript{}
	err = db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&script).Error
	return script, err
}

// UpdateInterviewScript replaces a (cycle, role) script's content.
func (i *InterviewDB) UpdateInterviewScript(ctx context.Context, cycleID string, role models.Role, in InterviewScriptUpdate) (models.InterviewScript, error) {
	return utils.UpdateReturning[models.InterviewScript](i.db.WithContext(ctx), map[string]any{
		"intro_speech":             in.IntroSpeech,
		"recording_reminder":       in.RecordingReminder,
		"questions":                models.JSONValue(in.Questions),
		"closing_note":             in.ClosingNote,
		"challenge_intro":          in.ChallengeIntro,
		"challenge_tracks":         models.JSONValue(in.ChallengeTracks),
		"post_interview_checklist": models.JSONValue(in.PostInterviewChecklist),
		"updated_by":               in.UpdatedBy,
		"updated_at":               gorm.Expr("NOW()"),
	}, "cycle_id = ? AND application_role = ?", cycleID, role)
}

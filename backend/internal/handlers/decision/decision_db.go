package decision

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type DecisionDB struct {
	db *gorm.DB
}

func NewDecisionDB(db *gorm.DB) *DecisionDB {
	return &DecisionDB{db: db}
}

// Seed content for a cycle's letters, copied from the one chiefs have been
// sending by hand. {{placeholders}} are filled in by the frontend's
// renderDecision; the trailing signature is left as a bracket for the admin to
// replace once per cycle.
const defaultDecisionSubject = `Generate Software Branch — {{cycle}} {{role}} Application Update`

const defaultPostInterviewBody = `Dear {{applicant_name}},

Thank you for your continued interest and investment in Generate's Software Branch and for taking the time to apply for the {{role}} position for {{cycle}}. Although you had a strong application after careful review, we have decided to move forward with other candidates.

To shed some light on this decision, {{feedback}} That being said, I really loved talking to you about {{compliments}}

I would also like to take this opportunity to **strongly encourage** you to re-apply as a **{{role}}** for this upcoming semester, and even put my name down as a referral, if you'd like to! Applications are currently projected to be out late July!

Thanking You,

[Signature — set once per cycle]`

const defaultGenericBody = `Dear {{applicant_name}},

Thank you for your continued interest and investment in Generate's Software Branch and for taking the time to apply for the {{role}} position for {{cycle}}. After careful review, we have decided to move forward with other candidates.

We received an exceptional number of strong applications this cycle and were only able to move a small portion of them forward to interviews, so this decision says far more about how competitive the pool was than it does about your application.

I would also like to take this opportunity to **strongly encourage** you to re-apply as a **{{role}}** for this upcoming semester, and even put my name down as a referral, if you'd like to! Applications are currently projected to be out late July!

Thanking You,

[Signature — set once per cycle]`

type decisionDraft struct{}

func (decisionDraft) TableName() string { return "decision_drafts" }

// decisionRow is the list query's shape; Status is computed in Go.
type decisionRow struct {
	ApplicationID   string
	CycleID         string
	ApplicationRole models.Role
	ApplicantNUID   string
	FullName        string
	Email           string
	Stage           models.ApplicationStage
	Kind            models.DecisionKind
	InterviewerNUID *string
	InterviewerName *string
	Feedback        *string
	Compliments     *string
	BodyOverride    *string
	AuthorNUID      *string
	AuthorName      *string
	SentAt          *time.Time
	SentBy          *string
	UpdatedAt       *time.Time
}

// GetOrCreateDecisionTemplates returns both of a (cycle, role)'s letters,
// seeding missing ones. Both go in one insert, so a concurrent first access
// can't leave a caller with half a set.
func (d *DecisionDB) GetOrCreateDecisionTemplates(ctx context.Context, cycleID string, role models.Role) ([]models.DecisionTemplate, error) {
	db := d.db.WithContext(ctx)
	seeds := []models.DecisionTemplate{
		{CycleID: cycleID, ApplicationRole: role, Kind: models.DecisionRejectionPostInterview, Subject: defaultDecisionSubject, Body: defaultPostInterviewBody},
		{CycleID: cycleID, ApplicationRole: role, Kind: models.DecisionRejectionGeneric, Subject: defaultDecisionSubject, Body: defaultGenericBody},
	}
	err := db.Select("cycle_id", "application_role", "kind", "subject", "body").
		Clauses(clause.OnConflict{DoNothing: true}).Create(&seeds).Error
	if err != nil {
		return nil, err
	}

	templates := []models.DecisionTemplate{}
	err = db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Order("kind").Find(&templates).Error
	return templates, err
}

// UpdateDecisionTemplate replaces one (cycle, role, kind) letter.
func (d *DecisionDB) UpdateDecisionTemplate(ctx context.Context, cycleID string, role models.Role, kind models.DecisionKind, in DecisionTemplateUpdate) (models.DecisionTemplate, error) {
	return utils.UpdateReturning[models.DecisionTemplate](d.db.WithContext(ctx),
		map[string]any{"subject": in.Subject, "body": in.Body, "updated_by": in.UpdatedBy},
		"cycle_id = ? AND application_role = ? AND kind = ?", cycleID, role, kind)
}

// decisionKindExpr is the draft's pinned kind, else derived from whether the
// applicant has an interview or an interviewer.
const decisionKindExpr = `COALESCE(dd.kind, CASE
		WHEN iv.interviewer_nuid IS NOT NULL OR ia.interviewer_nuid IS NOT NULL
		THEN 'rejection_post_interview'::decision_kind
		ELSE 'rejection_generic'::decision_kind
	END)`

const decisionRowColumns = `a.id AS application_id, a.cycle_id, a.application_role, a.user_nuid AS applicant_nuid,
	u.full_name, u.email, a.stage, ` + decisionKindExpr + ` AS kind,
	COALESCE(iv.interviewer_nuid, ia.interviewer_nuid) AS interviewer_nuid, iu.full_name AS interviewer_name,
	dd.feedback, dd.compliments, dd.body_override, dd.author_nuid, au.full_name AS author_name,
	dd.sent_at, dd.sent_by, dd.updated_at`

// decisionsFrom is shared by the list and the single-row lookup, so an
// authorization check can never read a different interviewer than the list
// showed. interviews and interview_assignments are UNIQUE (application_id), so
// neither join multiplies rows.
func decisionsFrom(db *gorm.DB, f DecisionFilter, applicationID string) *gorm.DB {
	q := db.Table("applications a").Select(decisionRowColumns).
		Joins("JOIN users u ON u.nuid = a.user_nuid").
		Joins("LEFT JOIN decision_drafts dd ON dd.application_id = a.id").
		Joins("LEFT JOIN interviews iv ON iv.application_id = a.id").
		Joins("LEFT JOIN interview_assignments ia ON ia.application_id = a.id").
		Joins("LEFT JOIN users iu ON iu.nuid = COALESCE(iv.interviewer_nuid, ia.interviewer_nuid)").
		Joins("LEFT JOIN users au ON au.nuid = dd.author_nuid").
		// Acceptances are handwritten, withdrawals get nothing, and drafts were
		// never submitted, so none of them belong on this page.
		Where("a.stage NOT IN ?", []models.ApplicationStage{models.StageDraft, models.StageAccepted, models.StageWithdrawn})

	if applicationID != "" {
		q = q.Where("a.id = ?", applicationID)
	}
	if len(f.ApplicationIDs) > 0 {
		q = q.Where("a.id IN ?", f.ApplicationIDs)
	}
	if f.CycleID != "" {
		q = q.Where("a.cycle_id = ?", f.CycleID)
	}
	if f.Role != nil {
		q = q.Where("a.application_role = ?", *f.Role)
	}
	if f.Kind != nil {
		q = q.Where(decisionKindExpr+" = ?", *f.Kind)
	}
	if f.InterviewerNUID != "" {
		q = q.Where("COALESCE(iv.interviewer_nuid, ia.interviewer_nuid) = ?", f.InterviewerNUID)
	}
	if f.Search != "" {
		q = q.Where(`u.full_name ILIKE @p ESCAPE '\' OR a.user_nuid ILIKE @p ESCAPE '\' OR u.email ILIKE @p ESCAPE '\'`,
			map[string]any{"p": "%" + utils.EscapeLike(f.Search) + "%"})
	}
	return q
}

// ListDecisions returns every applicant in the cycle getting a rejection, with
// whatever's been written for them, in one query.
func (d *DecisionDB) ListDecisions(ctx context.Context, f DecisionFilter) ([]models.DecisionRow, error) {
	var rows []decisionRow
	// Unwritten feedback first, then the longest-waiting applicants.
	err := decisionsFrom(d.db.WithContext(ctx), f, "").
		Order("(dd.feedback IS NULL OR dd.feedback = '') DESC").
		Order("a.submitted_at ASC NULLS LAST").
		Order("u.full_name ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]models.DecisionRow, len(rows))
	for i, r := range rows {
		out[i] = toDecisionRow(r)
	}
	return out, nil
}

// GetDecisionRow reads one application's row, so a write knows who owes the
// feedback and which kind applies.
func (d *DecisionDB) GetDecisionRow(ctx context.Context, applicationID string) (models.DecisionRow, error) {
	var row decisionRow
	err := decisionsFrom(d.db.WithContext(ctx), DecisionFilter{}, applicationID).Take(&row).Error
	if err != nil {
		return models.DecisionRow{}, utils.DBErr(err)
	}
	return toDecisionRow(row), nil
}

// UpsertDecisionDraft writes the per-applicant parts and returns the whole row.
// Marking sent also rejects the applicant and unmarking restores their stage:
// the email going out is the decision, so both happen in one transaction.
func (d *DecisionDB) UpsertDecisionDraft(ctx context.Context, applicationID string, in DecisionDraftUpdate) (models.DecisionRow, error) {
	var author, sentBy any
	if in.AuthorNUID != "" {
		author = in.AuthorNUID
	}
	if in.SentBy != "" {
		sentBy = in.SentBy
	}

	err := d.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Read before the upsert, so marking sent records the stage being left.
		if in.MarkSent != nil && *in.MarkSent {
			var app models.Application
			if err := tx.Select("stage").Where("id = ?", applicationID).Take(&app).Error; err != nil {
				return utils.DBErr(err)
			}
			// Re-marking must not stamp 'rejected', or unmarking becomes a no-op.
			if app.Stage != models.StageRejected {
				in.PreviousStage = &app.Stage
			}
		}

		// A NULL argument leaves a column alone and "" clears it, which
		// COALESCE alone can't express.
		keepOrClear := func(col string, v *string) clause.Assignment {
			return clause.Assignment{Column: clause.Column{Name: col}, Value: gorm.Expr(
				"CASE WHEN ?::text IS NULL THEN decision_drafts."+col+" ELSE NULLIF(?::text, '') END", v, v)}
		}
		sent := in.MarkSent != nil && *in.MarkSent
		insert := map[string]any{
			"application_id": applicationID,
			"kind":           in.Kind,
			"feedback":       gorm.Expr("NULLIF(?::text, '')", in.Feedback),
			"compliments":    gorm.Expr("NULLIF(?::text, '')", in.Compliments),
			"body_override":  gorm.Expr("NULLIF(?::text, '')", in.BodyOverride),
			"author_nuid":    author,
			"sent_at":        nil,
			"sent_by":        nil,
			"previous_stage": in.PreviousStage,
		}
		if sent {
			insert["sent_at"] = gorm.Expr("NOW()")
			insert["sent_by"] = sentBy
		}
		err := tx.Model(&decisionDraft{}).Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "application_id"}},
			DoUpdates: clause.Set{
				{Column: clause.Column{Name: "kind"}, Value: clause.Column{Table: "excluded", Name: "kind"}},
				keepOrClear("feedback", in.Feedback),
				keepOrClear("compliments", in.Compliments),
				keepOrClear("body_override", in.BodyOverride),
				{Column: clause.Column{Name: "author_nuid"}, Value: gorm.Expr("COALESCE(?::text, decision_drafts.author_nuid)", author)},
				{Column: clause.Column{Name: "sent_at"}, Value: gorm.Expr(
					"CASE WHEN ?::boolean IS NULL THEN decision_drafts.sent_at WHEN ?::boolean THEN COALESCE(decision_drafts.sent_at, NOW()) END",
					in.MarkSent, in.MarkSent)},
				{Column: clause.Column{Name: "sent_by"}, Value: gorm.Expr(
					"CASE WHEN ?::boolean IS NULL THEN decision_drafts.sent_by WHEN ?::boolean THEN COALESCE(decision_drafts.sent_by, ?::text) END",
					in.MarkSent, in.MarkSent, sentBy)},
				{Column: clause.Column{Name: "previous_stage"}, Value: gorm.Expr(
					"COALESCE(EXCLUDED.previous_stage, decision_drafts.previous_stage)")},
			},
		}).Create(insert).Error
		if err != nil {
			return err
		}

		if in.MarkSent != nil {
			return applyDecisionStage(tx, applicationID, *in.MarkSent)
		}
		return nil
	})
	if err != nil {
		return models.DecisionRow{}, err
	}
	return d.GetDecisionRow(ctx, applicationID)
}

// applyDecisionStage rejects the applicant when marked sent and restores their
// old stage when unmarked, but only from rejected, so a manual move survives.
func applyDecisionStage(tx *gorm.DB, applicationID string, sent bool) error {
	apps := tx.Model(&models.Application{}).Where("id = ?", applicationID)
	if sent {
		return apps.UpdateColumn("stage", models.StageRejected).Error
	}
	stamped := tx.Model(&decisionDraft{}).Select("application_id").Where("previous_stage IS NOT NULL")
	return apps.Where("stage = ? AND id IN (?)", models.StageRejected, stamped).
		UpdateColumn("stage", gorm.Expr("(SELECT d.previous_stage FROM decision_drafts d WHERE d.application_id = applications.id)")).
		Error
}

func toDecisionRow(r decisionRow) models.DecisionRow {
	return models.DecisionRow{
		ApplicationID:   r.ApplicationID,
		CycleID:         r.CycleID,
		ApplicationRole: r.ApplicationRole,
		ApplicantNUID:   r.ApplicantNUID,
		FullName:        r.FullName,
		Email:           r.Email,
		Stage:           r.Stage,
		Kind:            r.Kind,
		Status:          DecisionStatusFor(r.Kind, r.Feedback, r.Compliments, r.BodyOverride, r.SentAt),
		InterviewerNUID: r.InterviewerNUID,
		InterviewerName: r.InterviewerName,
		Feedback:        r.Feedback,
		Compliments:     r.Compliments,
		BodyOverride:    r.BodyOverride,
		AuthorNUID:      r.AuthorNUID,
		AuthorName:      r.AuthorName,
		SentAt:          r.SentAt,
		SentBy:          r.SentBy,
		UpdatedAt:       r.UpdatedAt,
	}
}

// DecisionStatusFor derives a row's status. A generic rejection is ready the
// moment it exists — its template has no blanks to fill. A post-interview one
// waits on both of the interviewer's paragraphs, unless a chief has already
// rewritten the message by hand.
func DecisionStatusFor(kind models.DecisionKind, feedback, compliments, bodyOverride *string, sentAt *time.Time) models.DecisionStatus {
	switch {
	case sentAt != nil:
		return models.DecisionSent
	case nonEmpty(bodyOverride):
		return models.DecisionReady
	case kind == models.DecisionRejectionGeneric:
		return models.DecisionReady
	case nonEmpty(feedback) && nonEmpty(compliments):
		return models.DecisionReady
	default:
		return models.DecisionPending
	}
}

func nonEmpty(s *string) bool { return s != nil && *s != "" }

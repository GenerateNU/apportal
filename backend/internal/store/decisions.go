package store

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

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

const decisionTemplateColumns = `id, cycle_id, application_role, kind, subject, body, created_at, updated_at, updated_by`

// DecisionTemplateUpdate replaces one letter. Chiefs edit subject and body as a
// single form, so there's no partial update.
type DecisionTemplateUpdate struct {
	Subject   string
	Body      string
	UpdatedBy string
}

// GetOrCreateDecisionTemplates returns both of a (cycle, role)'s letters,
// seeding either one with default content on first access — mirrors
// GetOrCreateInterviewScript, so callers never handle a missing row.
func (s *Store) GetOrCreateDecisionTemplates(ctx context.Context, cycleID string, role models.Role) ([]models.DecisionTemplate, error) {
	// Inserts both kinds in one statement and ignores whichever already
	// exists, then reads the pair back — so a concurrent first access can't
	// leave a caller with half a set.
	const insertQ = `
		INSERT INTO decision_templates (cycle_id, application_role, kind, subject, body)
		VALUES ($1, $2::application_role, 'rejection_post_interview', $3::text, $4::text),
		       ($1, $2::application_role, 'rejection_generic', $3::text, $5::text)
		ON CONFLICT (cycle_id, application_role, kind) DO NOTHING`
	if _, err := s.db.Exec(ctx, insertQ, cycleID, role,
		defaultDecisionSubject, defaultPostInterviewBody, defaultGenericBody); err != nil {
		return nil, err
	}

	const selectQ = `SELECT ` + decisionTemplateColumns + `
		FROM decision_templates WHERE cycle_id = $1 AND application_role = $2
		ORDER BY kind`
	rows, err := s.db.Query(ctx, selectQ, cycleID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.DecisionTemplate])
}

// UpdateDecisionTemplate replaces one (cycle, role, kind) letter. Chief-only at
// the handler layer.
func (s *Store) UpdateDecisionTemplate(ctx context.Context, cycleID string, role models.Role, kind models.DecisionKind, in DecisionTemplateUpdate) (models.DecisionTemplate, error) {
	const q = `
		UPDATE decision_templates SET
			subject    = $4,
			body       = $5,
			updated_by = $6
		WHERE cycle_id = $1 AND application_role = $2 AND kind = $3
		RETURNING ` + decisionTemplateColumns
	rows, err := s.db.Query(ctx, q, cycleID, role, kind, in.Subject, in.Body, in.UpdatedBy)
	if err != nil {
		return models.DecisionTemplate{}, err
	}
	t, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.DecisionTemplate])
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}

// DecisionFilter narrows the decisions list. CycleID is always set; the rest
// come from the page's filter row.
type DecisionFilter struct {
	CycleID string
	Role    *models.Role
	Kind    *models.DecisionKind
	// InterviewerNUID limits the list to applicants this reviewer interviewed —
	// what a lead's own queue is scoped to.
	InterviewerNUID string
	Search          string
	// ApplicationIDs limits the list to specific applications, for the context
	// endpoint's "which of these may this caller see" check.
	ApplicationIDs []string
}

// decisionRow mirrors the list query's columns positionally. Separate from
// models.DecisionRow because Status is computed in Go rather than selected.
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

// decisionsFrom builds FROM through WHERE. Both the list and the single-row
// lookup share it so an authorization check can never read a different
// interviewer than the list displayed.
//
// interviews and interview_assignments are both UNIQUE (application_id), so
// neither join can multiply a row.
func decisionsFrom(f DecisionFilter, applicationID string) (string, []any) {
	query := `
		FROM applications a
		JOIN users u ON u.nuid = a.user_nuid
		LEFT JOIN decision_drafts dd ON dd.application_id = a.id
		LEFT JOIN interviews iv ON iv.application_id = a.id
		LEFT JOIN interview_assignments ia ON ia.application_id = a.id
		LEFT JOIN users iu ON iu.nuid = COALESCE(iv.interviewer_nuid, ia.interviewer_nuid)
		LEFT JOIN users au ON au.nuid = dd.author_nuid
		WHERE 1 = 1`
	args := []any{}

	// Acceptances are handwritten, withdrawals get nothing, and a draft was
	// never submitted — none of them belong on this page.
	query += ` AND a.stage NOT IN ('draft', 'accepted', 'withdrawn')`

	if applicationID != "" {
		args = append(args, applicationID)
		query += ` AND a.id = $` + strconv.Itoa(len(args))
	}
	if len(f.ApplicationIDs) > 0 {
		args = append(args, f.ApplicationIDs)
		query += ` AND a.id = ANY($` + strconv.Itoa(len(args)) + `::uuid[])`
	}
	if f.CycleID != "" {
		args = append(args, f.CycleID)
		query += ` AND a.cycle_id = $` + strconv.Itoa(len(args))
	}
	if f.Role != nil {
		args = append(args, *f.Role)
		query += ` AND a.application_role = $` + strconv.Itoa(len(args))
	}
	if f.Kind != nil {
		args = append(args, *f.Kind)
		query += ` AND ` + decisionKindExpr + ` = $` + strconv.Itoa(len(args)) + `::decision_kind`
	}
	if f.InterviewerNUID != "" {
		args = append(args, f.InterviewerNUID)
		query += ` AND COALESCE(iv.interviewer_nuid, ia.interviewer_nuid) = $` + strconv.Itoa(len(args))
	}
	if f.Search != "" {
		args = append(args, "%"+escapeLike(f.Search)+"%")
		n := strconv.Itoa(len(args))
		query += ` AND (u.full_name ILIKE $` + n + ` ESCAPE '\'` +
			` OR a.user_nuid ILIKE $` + n + ` ESCAPE '\'` +
			` OR u.email ILIKE $` + n + ` ESCAPE '\')`
	}
	return query, args
}

// decisionKindExpr is the pinned kind if a draft exists, otherwise the one
// derived from whether the applicant has an interview or an interviewer
// assigned.
const decisionKindExpr = `COALESCE(dd.kind, CASE
		WHEN iv.interviewer_nuid IS NOT NULL OR ia.interviewer_nuid IS NOT NULL
		THEN 'rejection_post_interview'::decision_kind
		ELSE 'rejection_generic'::decision_kind
	END)`

const decisionRowColumns = `a.id, a.cycle_id, a.application_role, a.user_nuid, u.full_name, u.email, a.stage,
	` + decisionKindExpr + `,
	COALESCE(iv.interviewer_nuid, ia.interviewer_nuid), iu.full_name,
	dd.feedback, dd.compliments, dd.body_override, dd.author_nuid, au.full_name,
	dd.sent_at, dd.sent_by, dd.updated_at`

// ListDecisions returns every applicant in the cycle who is getting a
// rejection, with whatever's been written for them. One query for the whole
// page — the row carries everything it renders.
func (s *Store) ListDecisions(ctx context.Context, f DecisionFilter) ([]models.DecisionRow, error) {
	from, args := decisionsFrom(f, "")
	// Unwritten feedback first: the page's whole job is surfacing what's still
	// owed, and within that the longest-waiting applicants.
	query := `SELECT ` + decisionRowColumns + from +
		` ORDER BY (dd.feedback IS NULL OR dd.feedback = '') DESC, a.submitted_at ASC NULLS LAST, u.full_name ASC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	scanned, err := pgx.CollectRows(rows, pgx.RowToStructByPos[decisionRow])
	if err != nil {
		return nil, err
	}
	out := make([]models.DecisionRow, len(scanned))
	for i, r := range scanned {
		out[i] = toDecisionRow(r)
	}
	return out, nil
}

// GetDecisionRow reads one application's row. Handlers call it before a write
// to learn who owes the feedback and which kind applies.
func (s *Store) GetDecisionRow(ctx context.Context, applicationID string) (models.DecisionRow, error) {
	from, args := decisionsFrom(DecisionFilter{}, applicationID)
	rows, err := s.db.Query(ctx, `SELECT `+decisionRowColumns+from, args...)
	if err != nil {
		return models.DecisionRow{}, err
	}
	scanned, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[decisionRow])
	if errors.Is(err, pgx.ErrNoRows) {
		return models.DecisionRow{}, ErrNotFound
	}
	if err != nil {
		return models.DecisionRow{}, err
	}
	return toDecisionRow(scanned), nil
}

// DecisionDraftUpdate is a partial write. A nil field is left alone; a pointer
// to "" clears it. Kind is always supplied — the handler resolves the effective
// one from the existing row before calling, and the column is NOT NULL.
type DecisionDraftUpdate struct {
	Kind         models.DecisionKind
	Feedback     *string
	Compliments  *string
	BodyOverride *string
	AuthorNUID   string
	// MarkSent stamps or clears sent_at/sent_by, and rejects or un-rejects the
	// applicant with it. Nil leaves both alone.
	MarkSent *bool
	SentBy   string
	// PreviousStage is filled in by UpsertDecisionDraft itself, not by callers.
	PreviousStage *models.ApplicationStage
}

// UpsertDecisionDraft writes the per-applicant parts and returns the whole row
// back, so a caller updates its cache without a follow-up read.
//
// Marking sent also rejects the applicant, and unmarking restores the stage
// they were in — the email going out *is* the decision taking effect, so the
// two happen together or not at all. Hence the transaction.
func (s *Store) UpsertDecisionDraft(ctx context.Context, applicationID string, in DecisionDraftUpdate) (models.DecisionRow, error) {
	// COALESCE can't express "clear this", which a lead deleting their
	// paragraph needs — so a NULL argument means "leave alone" and an empty
	// string means "set to NULL".
	const q = `
		INSERT INTO decision_drafts (application_id, kind, feedback, compliments, body_override, author_nuid, sent_at, sent_by, previous_stage)
		VALUES ($1, $2::decision_kind, NULLIF($3::text, ''), NULLIF($4::text, ''), NULLIF($5::text, ''), $6::text,
		        CASE WHEN $7::boolean THEN NOW() END,
		        CASE WHEN $7::boolean THEN $8::text END,
		        $9::application_stage)
		ON CONFLICT (application_id) DO UPDATE SET
			kind          = $2::decision_kind,
			feedback      = CASE WHEN $3::text IS NULL THEN decision_drafts.feedback      ELSE NULLIF($3::text, '') END,
			compliments   = CASE WHEN $4::text IS NULL THEN decision_drafts.compliments   ELSE NULLIF($4::text, '') END,
			body_override = CASE WHEN $5::text IS NULL THEN decision_drafts.body_override ELSE NULLIF($5::text, '') END,
			author_nuid   = COALESCE($6::text, decision_drafts.author_nuid),
			sent_at       = CASE WHEN $7::boolean IS NULL THEN decision_drafts.sent_at
			                     WHEN $7::boolean THEN COALESCE(decision_drafts.sent_at, NOW()) END,
			sent_by       = CASE WHEN $7::boolean IS NULL THEN decision_drafts.sent_by
			                     WHEN $7::boolean THEN COALESCE(decision_drafts.sent_by, $8::text) END,
			previous_stage = COALESCE($9::application_stage, decision_drafts.previous_stage)`
	author := any(in.AuthorNUID)
	if in.AuthorNUID == "" {
		author = nil
	}
	sentBy := any(in.SentBy)
	if in.SentBy == "" {
		sentBy = nil
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return models.DecisionRow{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Captured before the upsert writes it, so marking sent stamps the stage
	// the applicant is actually leaving.
	if in.MarkSent != nil && *in.MarkSent {
		const stageQ = `SELECT stage FROM applications WHERE id = $1`
		var stage models.ApplicationStage
		if err := tx.QueryRow(ctx, stageQ, applicationID).Scan(&stage); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return models.DecisionRow{}, ErrNotFound
			}
			return models.DecisionRow{}, err
		}
		// Re-marking an already-sent decision must not overwrite the stamp with
		// 'rejected', which would make unmarking a no-op.
		if stage != models.StageRejected {
			in.PreviousStage = &stage
		}
	}

	if _, err := tx.Exec(ctx, q, applicationID, in.Kind,
		in.Feedback, in.Compliments, in.BodyOverride, author, in.MarkSent, sentBy,
		in.PreviousStage); err != nil {
		return models.DecisionRow{}, err
	}

	if in.MarkSent != nil {
		if err := applyDecisionStage(ctx, tx, applicationID, *in.MarkSent); err != nil {
			return models.DecisionRow{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return models.DecisionRow{}, err
	}
	return s.GetDecisionRow(ctx, applicationID)
}

// applyDecisionStage moves the applicant to rejected when the message is marked
// sent, and back to where they were when it's unmarked. The restore is scoped
// to `stage = 'rejected'` so it can't stomp a stage someone changed by hand in
// the meantime.
func applyDecisionStage(ctx context.Context, tx pgx.Tx, applicationID string, sent bool) error {
	if sent {
		const reject = `UPDATE applications SET stage = 'rejected' WHERE id = $1`
		_, err := tx.Exec(ctx, reject, applicationID)
		return err
	}
	const restore = `
		UPDATE applications a SET stage = d.previous_stage
		FROM decision_drafts d
		WHERE d.application_id = a.id AND a.id = $1
		  AND a.stage = 'rejected' AND d.previous_stage IS NOT NULL`
	_, err := tx.Exec(ctx, restore, applicationID)
	return err
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

package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ApplicationCreate struct {
	CycleID      string
	UserNUID     string
	Role         models.Role
	Availability json.RawMessage
	ResumeURL    *string
}

type ApplicationUpdate struct {
	Stage        *models.ApplicationStage
	Availability json.RawMessage
	ResumeURL    *string
	// MarkSubmitted stamps submitted_at = NOW() when true. Callers should only
	// set this on an actual draft->submitted transition, never on later
	// pipeline-stage changes or plain autosaves.
	MarkSubmitted bool
}

// AnswerFilter holds a filter for a specific question's answers.
type AnswerFilter struct {
	QuestionID   string
	QuestionType string
	Values       any // string for text/url, []any for checkbox/dropdown
}

// ApplicationFilter holds optional list filters; empty fields are ignored.
type ApplicationFilter struct {
	CycleID  string
	UserNUID string
	Role     *models.Role
	Stage    *models.ApplicationStage
	// Stages matches any of several stages, for callers that span more than one
	// (the review pool covers both submitted and lead_review). Combined with
	// Stage it narrows further, so callers should set one or the other.
	Stages        []models.ApplicationStage
	AnswerFilters []AnswerFilter
	// AssignedTo limits results to applications the given lead is assigned to
	// write-review (via lead_assignments).
	AssignedTo string
	// IncludeDraft allows draft applications into the results. Callers should
	// only set this when listing a user's own applications by their own
	// identity — drafts are otherwise invisible (reviewer queues, admin
	// counts, etc.).
	IncludeDraft bool
}

const applicationColumns = `id, cycle_id, user_nuid, application_role, stage, availability, resume_url, submitted_at, updated_at`

func (s *Store) CreateApplication(ctx context.Context, in ApplicationCreate) (models.Application, error) {
	const q = `
		INSERT INTO applications (cycle_id, user_nuid, application_role, availability, resume_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.UserNUID, in.Role,
		jsonArg(in.Availability), in.ResumeURL)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) GetApplication(ctx context.Context, id string) (models.Application, error) {
	const q = `SELECT ` + applicationColumns + ` FROM applications WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// applicationSummaryColumns matches models.ApplicationSummary's field order:
// Application's fields (positionally, per applicationColumns) followed by the
// joined applicant's full_name and email.
const applicationSummaryColumns = `a.id, a.cycle_id, a.user_nuid, a.application_role, a.stage, a.availability, a.resume_url, a.submitted_at, a.updated_at, u.full_name, u.email`

func (s *Store) ListApplications(ctx context.Context, f ApplicationFilter) ([]models.ApplicationSummary, error) {
	query := `SELECT DISTINCT ` + applicationSummaryColumns + ` FROM applications a JOIN users u ON u.nuid = a.user_nuid`
	args := []any{}

	// Add JOINs for each answer filter
	for i, af := range f.AnswerFilters {
		joinAlias := `wa` + strconv.Itoa(i)
		query += ` LEFT JOIN written_answers ` + joinAlias + ` ON ` + joinAlias + `.application_id = a.id AND ` + joinAlias + `.question_id = $` + strconv.Itoa(len(args)+1)
		args = append(args, af.QuestionID)
	}

	query += ` WHERE 1 = 1`
	if f.CycleID != "" {
		args = append(args, f.CycleID)
		query += ` AND a.cycle_id = $` + strconv.Itoa(len(args))
	}
	if f.UserNUID != "" {
		args = append(args, f.UserNUID)
		query += ` AND a.user_nuid = $` + strconv.Itoa(len(args))
	}
	if f.Role != nil {
		args = append(args, *f.Role)
		query += ` AND a.application_role = $` + strconv.Itoa(len(args))
	}
	if f.Stage != nil {
		args = append(args, *f.Stage)
		query += ` AND a.stage = $` + strconv.Itoa(len(args))
	}
	if len(f.Stages) > 0 {
		stages := make([]string, len(f.Stages))
		for i, s := range f.Stages {
			stages[i] = string(s)
		}
		args = append(args, stages)
		query += ` AND a.stage = ANY($` + strconv.Itoa(len(args)) + `::application_stage[])`
	}
	if f.AssignedTo != "" {
		args = append(args, f.AssignedTo)
		query += ` AND EXISTS (SELECT 1 FROM lead_assignments la` +
			` WHERE la.application_id = a.id AND la.lead_nuid = $` +
			strconv.Itoa(len(args)) + `)`
	}
	if !f.IncludeDraft {
		query += ` AND a.stage != 'draft'`
	}

	// Add WHERE conditions for answer filters
	for i, af := range f.AnswerFilters {
		joinAlias := `wa` + strconv.Itoa(i)
		if af.QuestionType == "checkbox" || af.QuestionType == "dropdown" {
			// For checkbox/dropdown, Values should be []any
			if options, ok := af.Values.([]any); ok {
				for _, opt := range options {
					args = append(args, opt)
					query += ` AND ` + joinAlias + `.answer_options @> jsonb_build_array($` + strconv.Itoa(len(args)) + `)`
				}
			}
		} else {
			// For text/url, Values should be string - use ILIKE for case-insensitive search
			if text, ok := af.Values.(string); ok {
				args = append(args, "%"+text+"%")
				query += ` AND ` + joinAlias + `.answer_text ILIKE $` + strconv.Itoa(len(args))
			}
		}
	}

	query += ` ORDER BY a.submitted_at DESC NULLS LAST`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.ApplicationSummary])
}

// DeleteDraftApplication discards an applicant's own in-progress draft. The
// stage='draft' and user_nuid match are enforced in the WHERE clause itself
// (rather than a separate fetch-then-check) so a non-owner or a
// non-draft application both fail the same way, without leaking which.
func (s *Store) DeleteDraftApplication(ctx context.Context, id, userNUID string) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM applications WHERE id = $1 AND user_nuid = $2 AND stage = 'draft'`,
		id, userNUID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdvanceApplicationsToLeadReview moves applications from submitted into
// lead_review once a reviewer is assigned. Guarded by stage='submitted' so
// it's a no-op for applications already past lead_review (or still draft),
// and safe to call redundantly for every assignment on an application.
func (s *Store) AdvanceApplicationsToLeadReview(ctx context.Context, applicationIDs []string) (int, error) {
	if len(applicationIDs) == 0 {
		return 0, nil
	}
	const q = `UPDATE applications SET stage = 'lead_review' WHERE id = ANY($1) AND stage = 'submitted'`
	tag, err := s.db.Exec(ctx, q, applicationIDs)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func (s *Store) UpdateApplication(ctx context.Context, id string, in ApplicationUpdate) (models.Application, error) {
	const q = `
		UPDATE applications SET
			stage        = COALESCE($2, stage),
			availability = COALESCE($3::jsonb, availability),
			resume_url   = COALESCE($4, resume_url),
			submitted_at = CASE WHEN $5 THEN NOW() ELSE submitted_at END
		WHERE id = $1
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, id, in.Stage, jsonArg(in.Availability), in.ResumeURL, in.MarkSubmitted)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

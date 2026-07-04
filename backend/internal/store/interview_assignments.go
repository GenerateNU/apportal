package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const interviewAssignmentColumns = `id, application_id, assigned_by, interviewer_nuid, assigned_at`
const interviewReviewAssignmentColumns = `id, application_id, lead_nuid, assigned_by, assigned_at`

// UpsertInterviewAssignment sets the single interviewer for an application
// (one per application, so a re-assign replaces the existing one).
func (s *Store) UpsertInterviewAssignment(ctx context.Context, applicationID, interviewerNUID, assignedBy string) (models.InterviewAssignment, error) {
	const q = `
		INSERT INTO interview_assignments (application_id, assigned_by, interviewer_nuid)
		VALUES ($1, $2, $3)
		ON CONFLICT (application_id) DO UPDATE SET
			assigned_by      = EXCLUDED.assigned_by,
			interviewer_nuid = EXCLUDED.interviewer_nuid,
			assigned_at      = NOW()
		RETURNING ` + interviewAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, assignedBy, interviewerNUID)
	if err != nil {
		return models.InterviewAssignment{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewAssignment])
}

func (s *Store) GetInterviewAssignment(ctx context.Context, applicationID string) (models.InterviewAssignment, error) {
	const q = `SELECT ` + interviewAssignmentColumns + ` FROM interview_assignments WHERE application_id = $1`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return models.InterviewAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewAssignment])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// CreateInterviewReviewAssignment assigns a lead to review the recording. Chiefs
// assign 2 leads per interview (enforced against cycle_stages elsewhere).
func (s *Store) CreateInterviewReviewAssignment(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.InterviewReviewAssignment, error) {
	const q = `
		INSERT INTO interview_review_assignments (application_id, lead_nuid, assigned_by)
		VALUES ($1, $2, $3)
		RETURNING ` + interviewReviewAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, leadNUID, assignedBy)
	if err != nil {
		return models.InterviewReviewAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewReviewAssignment])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) ListInterviewReviewAssignments(ctx context.Context, applicationID string) ([]models.InterviewReviewAssignment, error) {
	const q = `SELECT ` + interviewReviewAssignmentColumns + ` FROM interview_review_assignments WHERE application_id = $1 ORDER BY assigned_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewReviewAssignment])
}

func (s *Store) DeleteInterviewReviewAssignment(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM interview_review_assignments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

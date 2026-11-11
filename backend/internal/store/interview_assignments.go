package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const interviewAssignmentColumns = `id, application_id, assigned_by, interviewer_nuid, assigned_at`
const interviewReviewAssignmentColumns = `id, application_id, lead_nuid, assigned_by, assigned_at`

func (s *Store) CreateInterviewAssignment(ctx context.Context, applicationID, interviewerNUID, assignedBy string) (models.InterviewAssignment, error) {
	const q = `
		INSERT INTO interview_assignments (application_id, assigned_by, interviewer_nuid)
		VALUES ($1, $2, $3)
		RETURNING ` + interviewAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, assignedBy, interviewerNUID)
	if err != nil {
		return models.InterviewAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.InterviewAssignment])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) ListInterviewAssignments(ctx context.Context, applicationID string) ([]models.InterviewAssignment, error) {
	const q = `SELECT ` + interviewAssignmentColumns + ` FROM interview_assignments WHERE application_id = $1 ORDER BY assigned_at, id`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewAssignment])
}

func (s *Store) IsAssignedInterviewer(ctx context.Context, applicationID, nuid string) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM interview_assignments WHERE application_id = $1 AND interviewer_nuid = $2)`
	var assigned bool
	err := s.db.QueryRow(ctx, q, applicationID, nuid).Scan(&assigned)
	return assigned, err
}

func (s *Store) DeleteInterviewAssignment(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM interview_assignments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
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

func (s *Store) ListInterviewAssignmentsForApplications(ctx context.Context, applicationIDs []string) ([]models.InterviewAssignment, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + interviewAssignmentColumns + ` FROM interview_assignments WHERE application_id = ANY($1::uuid[]) ORDER BY application_id, assigned_at, id`
	rows, err := s.db.Query(ctx, q, applicationIDs)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewAssignment])
}

// ListInterviewReviewAssignmentsForApplications fetches recording-reviewer
// assignments for many applications in one round trip, mirroring
// ListInterviewAssignmentsForApplications above.
func (s *Store) ListInterviewReviewAssignmentsForApplications(ctx context.Context, applicationIDs []string) ([]models.InterviewReviewAssignment, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `SELECT ` + interviewReviewAssignmentColumns + ` FROM interview_review_assignments WHERE application_id = ANY($1::uuid[]) ORDER BY application_id, assigned_at`
	rows, err := s.db.Query(ctx, q, applicationIDs)
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

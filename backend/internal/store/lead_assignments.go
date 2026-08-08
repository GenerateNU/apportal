package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const leadAssignmentColumns = `id, application_id, lead_nuid, assigned_by, assigned_at`

// CreateLeadAssignment assigns a lead to write-review an application. Chiefs
// assign 3 leads per application (enforced against cycle_stages elsewhere).
func (s *Store) CreateLeadAssignment(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.LeadAssignment, error) {
	const q = `
		INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by)
		VALUES ($1, $2, $3)
		RETURNING ` + leadAssignmentColumns
	rows, err := s.db.Query(ctx, q, applicationID, leadNUID, assignedBy)
	if err != nil {
		return models.LeadAssignment{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.LeadAssignment])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) ListLeadAssignments(ctx context.Context, applicationID string) ([]models.LeadAssignment, error) {
	const q = `SELECT ` + leadAssignmentColumns + ` FROM lead_assignments WHERE application_id = $1 ORDER BY assigned_at`
	rows, err := s.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.LeadAssignment])
}

// ListLeadAssignmentsForCycle returns every lead assignment across a cycle's
// applications for one applicant role. The assignment planner needs the whole
// picture at once — per-application queries would be N round trips — so it can
// seed each lead's current load and each application's existing coverage.
// LeadAssignmentPair is one lead assigned to one application, for bulk writes.
type LeadAssignmentPair struct {
	ApplicationID string
	LeadNUID      string
}

// CreateLeadAssignments inserts many assignments at once and reports how many
// were actually new. It is a single statement, so it is atomic without an
// explicit transaction, and conflicts on the (application_id, lead_nuid) unique
// index are skipped rather than erroring — that makes committing the same plan
// twice a no-op instead of a failure, which is what a chief double-clicking
// "assign" should get.
func (s *Store) CreateLeadAssignments(ctx context.Context, pairs []LeadAssignmentPair, assignedBy string) (int, error) {
	if len(pairs) == 0 {
		return 0, nil
	}

	applicationIDs := make([]string, len(pairs))
	leadNUIDs := make([]string, len(pairs))
	for i, p := range pairs {
		applicationIDs[i] = p.ApplicationID
		leadNUIDs[i] = p.LeadNUID
	}

	const q = `
		INSERT INTO lead_assignments (application_id, lead_nuid, assigned_by)
		SELECT app_id, lead_nuid, $3
		FROM unnest($1::uuid[], $2::text[]) AS t(app_id, lead_nuid)
		ON CONFLICT (application_id, lead_nuid) DO NOTHING`
	tag, err := s.db.Exec(ctx, q, applicationIDs, leadNUIDs, assignedBy)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func (s *Store) ListLeadAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.LeadAssignment, error) {
	const q = `
		SELECT la.id, la.application_id, la.lead_nuid, la.assigned_by, la.assigned_at
		FROM lead_assignments la
		JOIN applications a ON a.id = la.application_id
		WHERE a.cycle_id = $1 AND a.application_role = $2
		ORDER BY la.assigned_at, la.id`
	rows, err := s.db.Query(ctx, q, cycleID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.LeadAssignment])
}

// ReviewerProgressRow is one lead's assignment of one application, with that
// review's submission status if any — the flat join ListReviewerProgressForCycle
// returns before it's grouped by lead.
type ReviewerProgressRow struct {
	LeadNUID      string
	ApplicationID string
	ApplicantNUID string
	FullName      string
	Email         string
	AssignedAt    time.Time
	SubmittedAt   *time.Time
}

// ListReviewerProgressForCycle returns, for every lead assignment in a cycle's
// applications of one role, whether that lead's written review has been
// submitted. Left-joining written_reviews (rather than filtering it) is what
// lets an assigned-but-not-yet-reviewed pair show up with a nil SubmittedAt
// instead of being silently omitted.
func (s *Store) ListReviewerProgressForCycle(ctx context.Context, cycleID string, role models.Role) ([]ReviewerProgressRow, error) {
	const q = `
		SELECT la.lead_nuid, la.application_id, a.user_nuid, u.full_name, u.email,
		       la.assigned_at, wr.submitted_at
		FROM lead_assignments la
		JOIN applications a ON a.id = la.application_id
		JOIN users u ON u.nuid = a.user_nuid
		LEFT JOIN written_reviews wr
			ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid
		WHERE a.cycle_id = $1 AND a.application_role = $2
		ORDER BY la.lead_nuid, la.assigned_at`
	rows, err := s.db.Query(ctx, q, cycleID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[ReviewerProgressRow])
}

func (s *Store) DeleteLeadAssignment(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM lead_assignments WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

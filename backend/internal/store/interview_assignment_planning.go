package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// ListInterviewAssignmentsForCycle returns every interviewer assignment
// across a cycle's applications for one applicant role — the interview
// planner needs the whole picture at once to seed each lead's load and know
// which applications already have an interviewer.
func (s *Store) ListInterviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewAssignment, error) {
	const q = `
		SELECT ia.id, ia.application_id, ia.assigned_by, ia.interviewer_nuid, ia.assigned_at
		FROM interview_assignments ia
		JOIN applications a ON a.id = ia.application_id
		WHERE a.cycle_id = $1 AND a.application_role = $2
		ORDER BY ia.assigned_at, ia.id`
	rows, err := s.db.Query(ctx, q, cycleID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewAssignment])
}

// ListInterviewReviewAssignmentsForCycle mirrors
// ListInterviewAssignmentsForCycle for interview_review_assignments.
func (s *Store) ListInterviewReviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) ([]models.InterviewReviewAssignment, error) {
	const q = `
		SELECT ira.id, ira.application_id, ira.lead_nuid, ira.assigned_by, ira.assigned_at
		FROM interview_review_assignments ira
		JOIN applications a ON a.id = ira.application_id
		WHERE a.cycle_id = $1 AND a.application_role = $2
		ORDER BY ira.assigned_at, ira.id`
	rows, err := s.db.Query(ctx, q, cycleID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.InterviewReviewAssignment])
}

// DeleteInterviewAssignmentsForCycle removes every interviewer assignment for
// one applicant role in a cycle at once — a chief clearing a botched or
// outdated assignment run. Returns how many rows were actually removed.
func (s *Store) DeleteInterviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	const q = `
		DELETE FROM interview_assignments ia
		USING applications a
		WHERE a.id = ia.application_id AND a.cycle_id = $1 AND a.application_role = $2`
	tag, err := s.db.Exec(ctx, q, cycleID, role)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// DeleteInterviewReviewAssignmentsForCycle mirrors
// DeleteInterviewAssignmentsForCycle for interview_review_assignments.
func (s *Store) DeleteInterviewReviewAssignmentsForCycle(ctx context.Context, cycleID string, role models.Role) (int, error) {
	const q = `
		DELETE FROM interview_review_assignments ira
		USING applications a
		WHERE a.id = ira.application_id AND a.cycle_id = $1 AND a.application_role = $2`
	tag, err := s.db.Exec(ctx, q, cycleID, role)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// InterviewAssignmentPair is one lead assigned to interview one application,
// for bulk writes.
type InterviewAssignmentPair struct {
	ApplicationID string
	LeadNUID      string
}

// CreateInterviewAssignments sets the interviewer for many applications at
// once, but only for applications that don't already have one. Unlike
// CreateLeadAssignments' ON CONFLICT DO NOTHING, interview_assignments has a
// replace-semantics UNIQUE(application_id) with ON CONFLICT DO UPDATE (see
// UpsertInterviewAssignment) — a plain bulk upsert here would clobber
// existing interviewers instead of skipping them. The planner never proposes
// a pair for an application that already has one, so the NOT EXISTS guard is
// defense against a concurrent commit racing this one, not something the
// planner itself relies on.
func (s *Store) CreateInterviewAssignments(ctx context.Context, pairs []InterviewAssignmentPair, assignedBy string) (int, error) {
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
		INSERT INTO interview_assignments (application_id, assigned_by, interviewer_nuid)
		SELECT app_id, $3, lead_nuid
		FROM unnest($1::uuid[], $2::text[]) AS t(app_id, lead_nuid)
		WHERE NOT EXISTS (
			SELECT 1 FROM interview_assignments ia WHERE ia.application_id = t.app_id
		)`
	tag, err := s.db.Exec(ctx, q, applicationIDs, leadNUIDs, assignedBy)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// InterviewReviewAssignmentPair is one lead assigned to review one
// application's interview, for bulk writes.
type InterviewReviewAssignmentPair struct {
	ApplicationID string
	LeadNUID      string
}

// CreateInterviewReviewAssignments inserts many recording-review assignments
// at once, skipping any that already exist — the same
// ON-CONFLICT-DO-NOTHING shape as CreateLeadAssignments, since
// interview_review_assignments has the same (application_id, lead_nuid)
// unique constraint.
func (s *Store) CreateInterviewReviewAssignments(ctx context.Context, pairs []InterviewReviewAssignmentPair, assignedBy string) (int, error) {
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
		INSERT INTO interview_review_assignments (application_id, lead_nuid, assigned_by)
		SELECT app_id, lead_nuid, $3
		FROM unnest($1::uuid[], $2::text[]) AS t(app_id, lead_nuid)
		ON CONFLICT (application_id, lead_nuid) DO NOTHING`
	tag, err := s.db.Exec(ctx, q, applicationIDs, leadNUIDs, assignedBy)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

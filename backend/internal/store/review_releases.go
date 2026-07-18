package store

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// review_releases holds the blind-review gate: a chief releases (or hides) a
// cycle's reviews of a given kind for one applicant role at once. These methods
// compute per-cycle × role progress and toggle the release row, plus cheap "is
// it released?" checks used to gate the per-application / per-interview review
// listings. Software engineer and software designer applicants are independent.

// assignedSubmittedSQL returns the (assigned, submitted) count queries for a
// review kind, both parameterised on $1 = cycle_id and $2 = role.
func assignedSubmittedSQL(kind models.ReviewKind) (assigned, submitted string) {
	switch kind {
	case models.ReviewKindRecording:
		assigned = `
			SELECT COUNT(*) FROM interview_review_assignments ira
			JOIN applications a ON a.id = ira.application_id
			WHERE a.cycle_id = $1 AND a.role = $2`
		submitted = `
			SELECT COUNT(*) FROM interview_recording_reviews rr
			JOIN interviews i   ON i.id = rr.interview_id
			JOIN applications a ON a.id = i.application_id
			WHERE a.cycle_id = $1 AND a.role = $2 AND rr.submitted_at IS NOT NULL`
	default: // written
		assigned = `
			SELECT COUNT(*) FROM lead_assignments la
			JOIN applications a ON a.id = la.application_id
			WHERE a.cycle_id = $1 AND a.role = $2`
		submitted = `
			SELECT COUNT(*) FROM written_reviews wr
			JOIN applications a ON a.id = wr.application_id
			WHERE a.cycle_id = $1 AND a.role = $2 AND wr.submitted_at IS NOT NULL`
	}
	return assigned, submitted
}

// ReviewGate reports the blind-review state of one review kind for one applicant
// role across a cycle: how many reviewers are assigned, how many have submitted,
// and whether a chief has released everyone's reviews to all reviewers.
func (s *Store) ReviewGate(ctx context.Context, cycleID string, role models.Role, kind models.ReviewKind) (models.ReviewGate, error) {
	gate := models.ReviewGate{CycleID: cycleID, Role: role, Kind: kind}
	assigned, submitted := assignedSubmittedSQL(kind)
	q := `
		SELECT
			(` + assigned + `),
			(` + submitted + `),
			r.released_by,
			r.released_at
		FROM (SELECT $1::uuid AS cycle_id) c
		LEFT JOIN review_releases r
			ON r.cycle_id = c.cycle_id AND r.role = $2 AND r.review_kind = $3`
	err := s.db.QueryRow(ctx, q, cycleID, string(role), string(kind)).Scan(
		&gate.AssignedCount, &gate.SubmittedCount, &gate.ReleasedBy, &gate.ReleasedAt)
	if err != nil {
		return gate, err
	}
	gate.Released = gate.ReleasedAt != nil
	return gate, nil
}

// SetReviewRelease releases (released=true) or hides (released=false) a cycle's
// reviews of the given kind for one applicant role, then returns the updated
// gate. Releasing is idempotent and keeps the original releaser/timestamp;
// hiding removes the release so reviewers fall back to seeing only their own.
// Chiefs may do either at any time, regardless of how many have submitted.
func (s *Store) SetReviewRelease(ctx context.Context, cycleID string, role models.Role, kind models.ReviewKind, released bool, releasedBy string) (models.ReviewGate, error) {
	if released {
		const q = `
			INSERT INTO review_releases (cycle_id, role, review_kind, released_by)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (cycle_id, role, review_kind) DO NOTHING`
		if _, err := s.db.Exec(ctx, q, cycleID, string(role), string(kind), releasedBy); err != nil {
			return models.ReviewGate{}, err
		}
	} else {
		const q = `DELETE FROM review_releases WHERE cycle_id = $1 AND role = $2 AND review_kind = $3`
		if _, err := s.db.Exec(ctx, q, cycleID, string(role), string(kind)); err != nil {
			return models.ReviewGate{}, err
		}
	}
	return s.ReviewGate(ctx, cycleID, role, kind)
}

// WrittenReviewsReleased reports whether the cycle+role owning the given
// application has had its written reviews released.
func (s *Store) WrittenReviewsReleased(ctx context.Context, applicationID string) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM review_releases r
			JOIN applications a ON a.cycle_id = r.cycle_id AND a.role = r.role
			WHERE a.id = $1 AND r.review_kind = 'written'
		)`
	var released bool
	err := s.db.QueryRow(ctx, q, applicationID).Scan(&released)
	return released, err
}

// RecordingReviewsReleased reports whether the cycle+role owning the given
// interview has had its recording review comments released.
func (s *Store) RecordingReviewsReleased(ctx context.Context, interviewID string) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM review_releases r
			JOIN applications a ON a.cycle_id = r.cycle_id AND a.role = r.role
			JOIN interviews i   ON i.application_id = a.id
			WHERE i.id = $1 AND r.review_kind = 'recording'
		)`
	var released bool
	err := s.db.QueryRow(ctx, q, interviewID).Scan(&released)
	return released, err
}

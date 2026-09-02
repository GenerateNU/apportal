package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// The bulk reads behind the decisions page's context panel. Each is the
// many-applications counterpart of a single-application method that already
// exists — the panel is opened per row but fetched per batch, so a lead's
// whole queue costs one request rather than three per applicant.

// ListWrittenReviewsForApplications is the bulk ListWrittenReviews, keyed by
// application. onlyReviewer scopes to one reviewer's own review, as blind
// review requires before a chief releases the cycle × role.
func (s *Store) ListWrittenReviewsForApplications(ctx context.Context, applicationIDs []string, onlyReviewer string) (map[string][]models.WrittenReviewDetail, error) {
	grouped := map[string][]models.WrittenReviewDetail{}
	if len(applicationIDs) == 0 {
		return grouped, nil
	}

	q := `SELECT ` + writtenReviewColumns + ` FROM written_reviews WHERE application_id = ANY($1::uuid[])`
	args := []any{applicationIDs}
	if onlyReviewer != "" {
		q += ` AND reviewer_nuid = $2`
		args = append(args, onlyReviewer)
	}
	q += ` ORDER BY application_id, created_at`

	rows, err := s.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	reviews, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.WrittenReview])
	if err != nil {
		return nil, err
	}

	ids := make([]string, len(reviews))
	reviewerNUIDs := make([]string, len(reviews))
	for i, r := range reviews {
		ids[i] = r.ID
		reviewerNUIDs[i] = r.ReviewerNUID
	}
	answers, err := s.listReviewAnswers(ctx, ids)
	if err != nil {
		return nil, err
	}
	names, err := s.namesByNUIDs(ctx, reviewerNUIDs)
	if err != nil {
		return nil, err
	}

	for _, r := range reviews {
		detail := models.WrittenReviewDetail{WrittenReview: r, Answers: answers[r.ID]}
		if detail.Answers == nil {
			detail.Answers = []models.WrittenReviewAnswer{}
		}
		detail.ReviewerName = names[r.ReviewerNUID]
		grouped[r.ApplicationID] = append(grouped[r.ApplicationID], detail)
	}
	return grouped, nil
}

// ListRecordingReviewDetailsForInterviews is ListRecordingReviewsForInterviews
// with each reviewer's display name resolved, keyed by interview. Unlike the
// progress-count bulk read, this keeps comments — the caller redacts them per
// the release rules.
func (s *Store) ListRecordingReviewDetailsForInterviews(ctx context.Context, interviewIDs []string) (map[string][]models.RecordingReviewDetail, error) {
	grouped := map[string][]models.RecordingReviewDetail{}
	if len(interviewIDs) == 0 {
		return grouped, nil
	}

	reviews, err := s.ListRecordingReviewsForInterviews(ctx, interviewIDs)
	if err != nil {
		return nil, err
	}
	reviewerNUIDs := make([]string, len(reviews))
	for i, r := range reviews {
		reviewerNUIDs[i] = r.ReviewerNUID
	}
	names, err := s.namesByNUIDs(ctx, reviewerNUIDs)
	if err != nil {
		return nil, err
	}
	for _, r := range reviews {
		grouped[r.InterviewID] = append(grouped[r.InterviewID], models.RecordingReviewDetail{
			InterviewRecordingReview: r,
			ReviewerName:             names[r.ReviewerNUID],
		})
	}
	return grouped, nil
}

// ReleasedApplications reports which of the given applications sit in a
// cycle × role whose reviews of that kind have been released — the bulk form of
// WrittenReviewsReleased/RecordingReviewsReleased, so a page of applicants
// costs one query instead of one per row.
func (s *Store) ReleasedApplications(ctx context.Context, kind models.ReviewKind, applicationIDs []string) (map[string]bool, error) {
	released := map[string]bool{}
	if len(applicationIDs) == 0 {
		return released, nil
	}
	const q = `
		SELECT a.id
		FROM applications a
		JOIN review_releases r
		  ON r.cycle_id = a.cycle_id AND r.application_role = a.application_role
		WHERE a.id = ANY($1::uuid[]) AND r.review_kind = $2`
	rows, err := s.db.Query(ctx, q, applicationIDs, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		released[id] = true
	}
	return released, rows.Err()
}

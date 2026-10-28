package reviewrelease

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ReviewReleaseDB struct {
	db *gorm.DB
}

func NewReviewReleaseDB(db *gorm.DB) *ReviewReleaseDB {
	return &ReviewReleaseDB{db: db}
}

type reviewRelease struct {
	CycleID         string
	ApplicationRole models.Role
	ReviewKind      models.ReviewKind
	ReleasedBy      *string
	ReleasedAt      *time.Time
}

func (reviewRelease) TableName() string { return "review_releases" }

// assignedSubmitted builds the assigned and submitted count queries for one
// review kind within a cycle × role.
func assignedSubmitted(db *gorm.DB, cycleID string, role models.Role, kind models.ReviewKind) (assigned, submitted *gorm.DB) {
	if kind == models.ReviewKindRecording {
		assigned = db.Table("interview_review_assignments ira").
			Joins("JOIN applications a ON a.id = ira.application_id")
		submitted = db.Table("interview_recording_reviews rr").
			Joins("JOIN interviews i ON i.id = rr.interview_id").
			Joins("JOIN applications a ON a.id = i.application_id").
			Where("rr.submitted_at IS NOT NULL")
	} else {
		assigned = db.Table("lead_assignments la").
			Joins("JOIN applications a ON a.id = la.application_id")
		submitted = db.Table("written_reviews wr").
			Joins("JOIN applications a ON a.id = wr.application_id").
			Where("wr.submitted_at IS NOT NULL")
	}
	scope := "a.cycle_id = ? AND a.application_role = ?"
	return assigned.Where(scope, cycleID, role), submitted.Where(scope, cycleID, role)
}

// ReviewGate reports one review kind's blind-review state for a cycle × role:
// assigned and submitted counts, and whether a chief released them.
func (r *ReviewReleaseDB) ReviewGate(ctx context.Context, cycleID string, role models.Role, kind models.ReviewKind) (models.ReviewGate, error) {
	db := r.db.WithContext(ctx)
	gate := models.ReviewGate{CycleID: cycleID, Role: role, Kind: kind}
	assigned, submitted := assignedSubmitted(db, cycleID, role, kind)

	var assignedCount, submittedCount int64
	if err := assigned.Count(&assignedCount).Error; err != nil {
		return gate, err
	}
	if err := submitted.Count(&submittedCount).Error; err != nil {
		return gate, err
	}
	gate.AssignedCount, gate.SubmittedCount = int(assignedCount), int(submittedCount)

	var release reviewRelease
	err := db.Where("cycle_id = ? AND application_role = ? AND review_kind = ?", cycleID, role, kind).Take(&release).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
	case err != nil:
		return gate, err
	default:
		gate.ReleasedBy, gate.ReleasedAt = release.ReleasedBy, release.ReleasedAt
	}
	gate.Released = gate.ReleasedAt != nil
	return gate, nil
}

// SetReviewRelease releases or hides a cycle × role's reviews of one kind and
// returns the new gate. Re-releasing keeps the original releaser and time.
func (r *ReviewReleaseDB) SetReviewRelease(ctx context.Context, cycleID string, role models.Role, kind models.ReviewKind, released bool, releasedBy string) (models.ReviewGate, error) {
	db := r.db.WithContext(ctx)
	if released {
		row := reviewRelease{CycleID: cycleID, ApplicationRole: role, ReviewKind: kind, ReleasedBy: &releasedBy}
		err := db.Select("cycle_id", "application_role", "review_kind", "released_by").
			Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
		if err != nil {
			return models.ReviewGate{}, err
		}
	} else {
		err := db.Where("cycle_id = ? AND application_role = ? AND review_kind = ?", cycleID, role, kind).
			Delete(&reviewRelease{}).Error
		if err != nil {
			return models.ReviewGate{}, err
		}
	}
	return r.ReviewGate(ctx, cycleID, role, kind)
}

// WrittenReviewsReleased reports whether the application's cycle × role has
// had its written reviews released.
func (r *ReviewReleaseDB) WrittenReviewsReleased(ctx context.Context, applicationID string) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Table("review_releases r").
		Joins("JOIN applications a ON a.cycle_id = r.cycle_id AND a.application_role = r.application_role").
		Where("a.id = ? AND r.review_kind = ?", applicationID, models.ReviewKindWritten).
		Count(&n).Error
	return n > 0, err
}

// RecordingReviewsReleased reports whether the interview's cycle × role has
// had its recording reviews released.
func (r *ReviewReleaseDB) RecordingReviewsReleased(ctx context.Context, interviewID string) (bool, error) {
	var n int64
	err := r.db.WithContext(ctx).Table("review_releases r").
		Joins("JOIN applications a ON a.cycle_id = r.cycle_id AND a.application_role = r.application_role").
		Joins("JOIN interviews i ON i.application_id = a.id").
		Where("i.id = ? AND r.review_kind = ?", interviewID, models.ReviewKindRecording).
		Count(&n).Error
	return n > 0, err
}

// ReleasedApplications reports which applications sit in a cycle × role whose
// reviews of this kind are released: the batch form of the checks above.
func (r *ReviewReleaseDB) ReleasedApplications(ctx context.Context, kind models.ReviewKind, applicationIDs []string) (map[string]bool, error) {
	released := map[string]bool{}
	if len(applicationIDs) == 0 {
		return released, nil
	}
	var ids []string
	err := r.db.WithContext(ctx).Table("applications a").
		Joins("JOIN review_releases r ON r.cycle_id = a.cycle_id AND r.application_role = a.application_role").
		Where("a.id IN ? AND r.review_kind = ?", applicationIDs, kind).
		Pluck("a.id", &ids).Error
	for _, id := range ids {
		released[id] = true
	}
	return released, err
}

package workflow

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func reviewStep(k models.ReviewKind) models.Step {
	if k == models.ReviewKindRecording {
		return models.StepInterviews
	}
	return models.StepReviews
}

// setPeerRelease shows reviewers each other's reviews of one kind for an opening, or hides them again.
func setPeerRelease(db *gorm.DB, cycleID, roleID string, k models.ReviewKind, released bool, caller Caller) (Preview, error) {
	if !k.Valid() {
		return Preview{}, invalid("kind must be 'written' or 'recording'")
	}
	s := reviewStep(k)
	return execute(db, cycleID, change{
		preview: func(_ *gorm.DB, f *CycleState) (Preview, error) {
			var p Preview
			if err := f.RequireEnabled(s); err != nil {
				return p, err
			}
			if f.RoleName(roleID) == "" {
				return p, invalid("role is not part of this cycle")
			}
			if f.PeersReleased[key{roleID, s}] == released {
				p.Unchanged = true
				return p, nil
			}
			op := caller.operation(OpReleaseReviews, s, roleID)
			if released {
				p.Say(fmt.Sprintf("Show %s reviewers each other's %s reviews", f.RoleName(roleID), k))
			} else {
				op.Level, op.Reason = LevelOverride, "reviewers have already seen each other's reviews"
				p.Say(fmt.Sprintf("Hide %s reviewers' %s reviews from each other again", f.RoleName(roleID), k))
			}
			p.Require(op)
			return p, nil
		},
		apply: func(tx *gorm.DB, _ *CycleState, _ Preview) error {
			if !released {
				return tx.Where("cycle_id = ? AND role_id = ? AND review_kind = ?", cycleID, roleID, k).Delete(&models.ReviewRelease{}).Error
			}
			row := models.ReviewRelease{CycleID: cycleID, RoleID: roleID, ReviewKind: k, ReleasedBy: caller.NUID, ReleasedAt: time.Now()}
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
		},
	})
}

type gateCount struct {
	RoleID string
	N      int
}

// loadReviewGates reports, per opening and review kind, assignment and submission progress and whether peers are released.
func loadReviewGates(db *gorm.DB, cycleID string) ([]models.ReviewGate, error) {
	f, err := Load(db, cycleID)
	if err != nil {
		return nil, err
	}
	written := db.Table("lead_assignments la").Joins("JOIN applications a ON a.id = la.application_id")
	writtenDone := db.Table("written_reviews wr").Joins("JOIN applications a ON a.id = wr.application_id").Where("wr.submitted_at IS NOT NULL")
	recording := db.Table("interview_reviewers r").Joins("JOIN interviews i ON i.id = r.interview_id").Joins("JOIN applications a ON a.id = i.application_id")
	recordingDone := db.Table("interview_reviewers r").Joins("JOIN interviews i ON i.id = r.interview_id").Joins("JOIN applications a ON a.id = i.application_id").Where("r.writeup_submitted_at IS NOT NULL")
	counts := map[models.ReviewKind][2]map[string]int{}
	for k, qs := range map[models.ReviewKind][2]*gorm.DB{
		models.ReviewKindWritten:   {written, writtenDone},
		models.ReviewKindRecording: {recording, recordingDone},
	} {
		var pair [2]map[string]int
		for i, q := range qs {
			var rows []gateCount
			if err := q.Select("a.role_id, count(*) AS n").Where("a.cycle_id = ?", cycleID).Group("a.role_id").Scan(&rows).Error; err != nil {
				return nil, err
			}
			pair[i] = map[string]int{}
			for _, r := range rows {
				pair[i][r.RoleID] = r.N
			}
		}
		counts[k] = pair
	}
	var releases []models.ReviewRelease
	if err := db.Where("cycle_id = ?", cycleID).Find(&releases).Error; err != nil {
		return nil, err
	}
	out := []models.ReviewGate{}
	for _, o := range f.Openings {
		for _, k := range []models.ReviewKind{models.ReviewKindWritten, models.ReviewKindRecording} {
			if !f.Enabled[reviewStep(k)] {
				continue
			}
			g := models.ReviewGate{CycleID: cycleID, RoleID: o.RoleID, Kind: k, AssignedCount: counts[k][0][o.RoleID], SubmittedCount: counts[k][1][o.RoleID]}
			for _, r := range releases {
				if r.RoleID == o.RoleID && r.ReviewKind == k {
					g.Released, g.ReleasedBy, g.ReleasedAt = true, &r.ReleasedBy, &r.ReleasedAt
				}
			}
			out = append(out, g)
		}
	}
	return out, nil
}

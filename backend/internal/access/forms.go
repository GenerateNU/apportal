package access

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

// RequireForm lets staff who can review the cycle read any of its forms, and
// anyone else read a role's form only while it's open in an open cycle, or
// when they applied for that role (to look back at their application).
func (c *Checker) RequireForm(ctx context.Context, cycleID, roleID string) error {
	actor, err := currentActor(ctx)
	signedIn := err == nil
	if signedIn {
		cycle, err := c.Cycle(ctx, cycleID)
		if err != nil {
			return err
		}
		if cycle.Allows(ReviewCycle) {
			return nil
		}
	}
	if roleID == "" {
		return notFound()
	}
	db := c.db.WithContext(ctx)
	var n int64
	if err := openForm(db, cycleID, roleID).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 && signedIn {
		if err := ownApplication(db, cycleID, roleID, actor.NUID).Count(&n).Error; err != nil {
			return utils.StoreErr(err)
		}
	}
	if n == 0 {
		return notFound()
	}
	return nil
}

// RequireOpenForm 404s unless the role's form is open in an open cycle, the
// only time anyone can start an application.
func (c *Checker) RequireOpenForm(ctx context.Context, cycleID, roleID string) error {
	if err := RequireActor(ctx); err != nil {
		return err
	}
	var n int64
	if err := openForm(c.db.WithContext(ctx), cycleID, roleID).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 {
		return notFound()
	}
	return nil
}

func openForm(db *gorm.DB, cycleID, roleID string) *gorm.DB {
	q := db.Table("application_templates at").
		Joins("JOIN cycles c ON c.id = at.cycle_id").
		Where("at.cycle_id = ? AND at.role_id = ?", cycleID, roleID).
		Where("c.status = ?", models.CycleOpen)
	return workflow.AcceptingApplications(q, "at")
}

func ownApplication(db *gorm.DB, cycleID, roleID, nuid string) *gorm.DB {
	return db.Model(&models.Application{}).
		Where("cycle_id = ? AND role_id = ? AND user_nuid = ?", cycleID, roleID, nuid)
}

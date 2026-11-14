package access

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// VisibleCycleIDs selects the IDs of cycles where the caller has at least
// want, for filtering lists (`cycle_id IN (?)`). Empty without a caller.
func (c *Checker) VisibleCycleIDs(ctx context.Context, want Level) *gorm.DB {
	actor, _ := middleware.ActorFrom(ctx)
	return visibleCycleIDs(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID, want)
}

// visibleCycleIDs is the rules table as SQL, so lists agree with LevelFor.
func visibleCycleIDs(db *gorm.DB, admin bool, nuid string, want Level) *gorm.DB {
	q := db.Table("cycles c").Select("c.id")
	if admin {
		if adminRule.level < want {
			return q.Where("FALSE")
		}
		return q.Where("c.status IN ?", adminRule.statuses).Where("c.application_type IN ?", adminRule.types)
	}
	q = q.Joins("JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = ?", nuid)
	conds := db.Where("FALSE")
	for _, s := range staffRules {
		if s.level < want {
			continue
		}
		conds = conds.Or("cs.role = ? AND c.application_type IN ? AND c.status IN ?", s.role, s.types, s.statuses)
	}
	return q.Where(conds)
}

// VisibleApplicationIDs keeps the ids whose cycle grants the caller want, in
// one query. Hidden and missing ids are dropped, not reported.
func (c *Checker) VisibleApplicationIDs(ctx context.Context, ids []string, want Level) ([]string, error) {
	actor, err := currentActor(ctx)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []string{}, nil
	}
	out := []string{}
	if err := visibleApplicationIDs(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID, ids, want).Find(&out).Error; err != nil {
		return nil, utils.StoreErr(err)
	}
	return out, nil
}

func visibleApplicationIDs(db *gorm.DB, admin bool, nuid string, ids []string, want Level) *gorm.DB {
	return db.Model(&models.Application{}).Select("id").
		Where("id IN ?", ids).
		Where("cycle_id IN (?)", visibleCycleIDs(db, admin, nuid, want))
}

// RequireApplicant 404s unless the caller has want on a cycle the person
// applied to — for data kept on the person, not one application.
func (c *Checker) RequireApplicant(ctx context.Context, nuid string, want Level) error {
	return c.requireExists(ctx, want, func(db, visible *gorm.DB) *gorm.DB {
		return db.Table("applications").Where("user_nuid = ? AND cycle_id IN (?)", nuid, visible)
	})
}

// RequireAnyCycle 403s unless the caller has want on at least one cycle.
func (c *Checker) RequireAnyCycle(ctx context.Context, want Level) error {
	err := c.requireExists(ctx, want, func(_, visible *gorm.DB) *gorm.DB { return visible })
	var se huma.StatusError
	if errors.As(err, &se) && se.GetStatus() == http.StatusNotFound {
		return huma.Error403Forbidden("staff role required")
	}
	return err
}

// requireExists 404s unless rows, given the caller's visible cycles, finds any.
func (c *Checker) requireExists(ctx context.Context, want Level, rows func(db, visible *gorm.DB) *gorm.DB) error {
	actor, err := currentActor(ctx)
	if err != nil {
		return err
	}
	db := c.db.WithContext(ctx)
	var n int64
	if err := rows(db, visibleCycleIDs(db, IsAdmin(actor), actor.NUID, want)).Limit(1).Count(&n).Error; err != nil {
		return utils.StoreErr(err)
	}
	if n == 0 {
		return notFound()
	}
	return nil
}

// ListableCycles is a condition on cycles for the caller's cycle list: open
// cycles, ones they applied to, and ones they can see as staff. Nil for
// admins, who list every cycle.
func (c *Checker) ListableCycles(ctx context.Context) *gorm.DB {
	actor, _ := middleware.ActorFrom(ctx)
	return listableCycles(c.db.WithContext(ctx), IsAdmin(actor), actor.NUID)
}

func listableCycles(db *gorm.DB, admin bool, nuid string) *gorm.DB {
	if admin {
		return nil
	}
	cond := db.Where("status = ?", models.CycleOpen)
	if nuid == "" {
		return cond
	}
	applied := db.Model(&models.Application{}).Select("cycle_id").Where("user_nuid = ?", nuid)
	return cond.
		Or("id IN (?)", applied).
		Or("id IN (?)", visibleCycleIDs(db, false, nuid, Review))
}

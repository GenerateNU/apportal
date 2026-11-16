package reviewrules

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

// Maps are keyed by role (opening) ID and cover every opening on the cycle.
type Rules interface {
	PerApplicant(ctx context.Context, cycleID string) (int, error)
	Released(ctx context.Context, cycleID string) (map[string]bool, error)
	Frozen(ctx context.Context, cycleID string) (map[string]bool, error)
	Eligible(ctx context.Context, cycleID string) (map[string][]string, error)
}

func ErrNoPerApplicant() error {
	return huma.Error409Conflict("Set how many reviewers each applicant gets on the Reviews step first.")
}

func ErrFrozen() error {
	return huma.Error409Conflict("Reviews are frozen for this opening because the next step has started.")
}

type Default struct {
	db *gorm.DB
}

func NewDefault(db *gorm.DB) *Default {
	return &Default{db: db}
}

// PerApplicant is 0 until the cycle sets reviewers-each on the reviews step.
func (d *Default) PerApplicant(ctx context.Context, cycleID string) (int, error) {
	var a models.StepAssignment
	err := d.db.WithContext(ctx).
		Where("cycle_id = ? AND step = ? AND kind = ?", cycleID, models.StepReviews, models.KindReviewer).
		Take(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	return a.PerApplicant, err
}

func (d *Default) Released(ctx context.Context, cycleID string) (map[string]bool, error) {
	return d.byOpening(ctx, cycleID, func(f *pipeline.Facts, role string) bool {
		return f.Released(role, models.StepReviews)
	})
}

// Frozen is empty for admins, who may change reviewers after the next step starts.
func (d *Default) Frozen(ctx context.Context, cycleID string) (map[string]bool, error) {
	if actor, _ := middleware.ActorFrom(ctx); actor.HasRole(models.UserRoleAdmin) {
		return map[string]bool{}, nil
	}
	return d.byOpening(ctx, cycleID, func(f *pipeline.Facts, role string) bool {
		return f.Frozen(role, models.StepReviews)
	})
}

func (d *Default) byOpening(ctx context.Context, cycleID string, pick func(*pipeline.Facts, string) bool) (map[string]bool, error) {
	f, err := pipeline.Load(d.db.WithContext(ctx), cycleID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(f.Openings))
	for _, o := range f.Openings {
		if pick(f, o.RoleID) {
			out[o.RoleID] = true
		}
	}
	return out, nil
}

func (d *Default) Eligible(ctx context.Context, cycleID string) (map[string][]string, error) {
	db := d.db.WithContext(ctx)
	var roles []string
	if err := db.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Order("id").Pluck("id", &roles).Error; err != nil {
		return nil, err
	}
	o, err := staffing.LoadOpenings(db, cycleID)
	if err != nil {
		return nil, err
	}
	out := make(map[string][]string, len(roles))
	for _, r := range roles {
		out[r] = o.Eligible(r, models.KindReviewer)
	}
	return out, nil
}

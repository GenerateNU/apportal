package staffing

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/pipeline"
)

// Released and Frozen are per role, for the interviews step; a zero limit means the count isn't set.
type Policy struct {
	Limits   map[models.StepKind]int
	Released map[string]bool
	Frozen   map[string]error
}

type InterviewRules interface {
	Load(ctx context.Context, db *gorm.DB, cycleID string) (Policy, error)
}

type Conflicts interface {
	Conflicted(ctx context.Context, db *gorm.DB, cycleID string, applicantNUIDs []string) (map[string]map[string]bool, error)
}

type NoConflicts struct{}

func (NoConflicts) Conflicted(context.Context, *gorm.DB, string, []string) (map[string]map[string]bool, error) {
	return map[string]map[string]bool{}, nil
}

type StoredConflicts struct{}

func (StoredConflicts) Conflicted(ctx context.Context, db *gorm.DB, cycleID string, applicantNUIDs []string) (map[string]map[string]bool, error) {
	out := map[string]map[string]bool{}
	if len(applicantNUIDs) == 0 {
		return out, nil
	}
	var rows []struct{ ApplicantNUID, LeadNUID string }
	err := db.WithContext(ctx).Table("review_conflicts").Select("applicant_nuid, lead_nuid").
		Where("cycle_id = ? AND applicant_nuid IN ?", cycleID, applicantNUIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		if out[r.ApplicantNUID] == nil {
			out[r.ApplicantNUID] = map[string]bool{}
		}
		out[r.ApplicantNUID][r.LeadNUID] = true
	}
	return out, nil
}

type PipelineRules struct{}

func (PipelineRules) Load(ctx context.Context, db *gorm.DB, cycleID string) (Policy, error) {
	f, err := pipeline.Load(db, cycleID)
	if err != nil {
		return Policy{}, err
	}
	return PolicyFrom(f, isAdmin(ctx)), nil
}

var kindStep = map[models.StepKind]models.Step{
	models.KindReviewer:          models.StepReviews,
	models.KindInterviewer:       models.StepInterviews,
	models.KindRecordingReviewer: models.StepInterviews,
}

func PolicyFrom(f *pipeline.Facts, admin bool) Policy {
	p := Policy{Limits: map[models.StepKind]int{}, Released: map[string]bool{}, Frozen: map[string]error{}}
	for _, k := range models.StaffKinds {
		if s := kindStep[k]; f.Enabled[s] {
			p.Limits[k] = f.Assignments[s][k]
		}
	}
	for _, o := range f.Openings {
		p.Released[o.RoleID] = f.Released(o.RoleID, models.StepInterviews)
		p.Frozen[o.RoleID] = f.Lock(pipeline.Action{Op: pipeline.OpAssign, Step: models.StepInterviews, RoleID: o.RoleID, Admin: admin})
	}
	return p
}

func isAdmin(ctx context.Context) bool {
	actor, _ := middleware.ActorFrom(ctx)
	return actor.HasRole(models.UserRoleAdmin)
}

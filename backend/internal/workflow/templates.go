package workflow

import (
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func AcceptingApplications(q *gorm.DB, alias string) *gorm.DB {
	return q.
		Joins("JOIN opening_steps os_apps ON os_apps.cycle_id = "+alias+".cycle_id AND os_apps.role_id = "+alias+".role_id AND os_apps.step = ? AND os_apps.released_at IS NOT NULL", models.StepApplications).
		Joins("LEFT JOIN opening_deadlines od_apps ON od_apps.cycle_id = "+alias+".cycle_id AND od_apps.role_id = "+alias+".role_id AND od_apps.step = ? AND od_apps.kind = ?", models.StepApplications, models.KindApplicant).
		Where("od_apps.due_at IS NULL OR od_apps.due_at > now() OR NOT od_apps.hard")
}

func stateStatus(s State) models.CycleStatus {
	switch s {
	case StateOpen:
		return models.CycleOpen
	case StateClosed:
		return models.CycleClosed
	}
	return models.CycleDraft
}

func FillTemplates(db *gorm.DB, templates []models.ApplicationTemplate, now time.Time) error {
	if len(templates) == 0 {
		return nil
	}
	roles := make([]string, 0, len(templates))
	for _, t := range templates {
		roles = append(roles, t.RoleID)
	}
	steps := []models.Step{models.StepApplications, models.StepReviews}
	var releases []models.OpeningStep
	if err := db.Where("role_id IN ? AND step IN ? AND released_at IS NOT NULL", roles, steps).Find(&releases).Error; err != nil {
		return err
	}
	var deadlines []models.OpeningDeadline
	if err := db.Where("role_id IN ? AND step IN ?", roles, steps).Find(&deadlines).Error; err != nil {
		return err
	}
	f := NewCycleState("")
	for _, r := range releases {
		f.SetRelease(r.RoleID, r.Step, *r.ReleasedAt)
	}
	for _, d := range deadlines {
		f.SetDeadline(d.RoleID, d.Step, Deadline{Kind: d.Kind, DueAt: d.DueAt, Hard: d.Hard})
	}
	for i := range templates {
		fillTemplate(f, &templates[i], now)
	}
	return nil
}

func fillTemplate(f *CycleState, t *models.ApplicationTemplate, now time.Time) {
	t.Status = stateStatus(f.State(t.RoleID, models.StepApplications, now))
	t.ReviewStatus = stateStatus(f.State(t.RoleID, models.StepReviews, now))
	t.ClosesAt, t.ReviewClosesAt = nil, nil
	if d, ok := f.Deadline(t.RoleID, models.StepApplications, models.KindApplicant); ok {
		t.ClosesAt = &d.DueAt
	}
	if d, ok := f.Deadline(t.RoleID, models.StepReviews, models.KindReviewer); ok {
		t.ReviewClosesAt = &d.DueAt
	}
}

package pipeline

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
	f := NewFacts("")
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

func fillTemplate(f *Facts, t *models.ApplicationTemplate, now time.Time) {
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

type TemplateTimeline struct {
	ClosesAt       *time.Time
	Status         *models.CycleStatus
	ReviewClosesAt *time.Time
	ReviewStatus   *models.CycleStatus
}

func ApplyTemplateTimeline(db *gorm.DB, cycleID, roleID string, in TemplateTimeline, actor Actor, now time.Time) error {
	if in.ClosesAt == nil && in.Status == nil && in.ReviewClosesAt == nil && in.ReviewStatus == nil {
		return nil
	}
	return inTx(db, cycleID, func(tx *gorm.DB, f *Facts) error {
		type side struct {
			step        models.Step
			kind        models.StepKind
			due         *time.Time
			status      *models.CycleStatus
			defaultHard bool
		}
		for _, sd := range []side{
			{models.StepApplications, models.KindApplicant, in.ClosesAt, in.Status, true},
			{models.StepReviews, models.KindReviewer, in.ReviewClosesAt, in.ReviewStatus, false},
		} {
			if sd.due != nil {
				if err := setDeadline(tx, f, DeadlineInput{CycleID: cycleID, RoleID: roleID, Step: sd.step, Kind: sd.kind, DueAt: *sd.due, DefaultHard: sd.defaultHard, Actor: actor}); err != nil {
					return err
				}
			}
			if sd.status == nil {
				continue
			}
			if err := applyStatus(tx, f, roleID, sd.step, sd.kind, *sd.status, sd.defaultHard, actor, now); err != nil {
				return err
			}
		}
		return nil
	})
}

func applyStatus(tx *gorm.DB, f *Facts, roleID string, s models.Step, k models.StepKind, status models.CycleStatus, defaultHard bool, actor Actor, now time.Time) error {
	current := f.State(roleID, s, now)
	switch status {
	case models.CycleDraft:
		return unrelease(tx, f, roleID, s, actor)
	case models.CycleOpen:
		if current == StateClosed {
			return conflict("extend the %s deadline to reopen %s", k, Label(s))
		}
		return release(tx, f, roleID, s, actor, now)
	case models.CycleClosed, models.CycleArchived:
		if current == StateDraft {
			return conflict("%s must be released before it can close", Label(s))
		}
		if current == StateClosed {
			return nil
		}
		return setDeadline(tx, f, DeadlineInput{CycleID: f.CycleID, RoleID: roleID, Step: s, Kind: k, DueAt: now, DefaultHard: defaultHard, Actor: actor})
	}
	return invalid("invalid status")
}

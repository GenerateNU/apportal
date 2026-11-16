package workflow

import (
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type AssignmentView struct {
	Kind         models.StepKind `json:"kind"`
	PerApplicant int             `json:"per_applicant"`
}

type StepConfig struct {
	Step        models.Step      `json:"step"`
	Label       string           `json:"label"`
	Enabled     bool             `json:"enabled"`
	CompletedAt *time.Time       `json:"completed_at,omitempty"`
	Assignments []AssignmentView `json:"assignments"`
}

type DeadlineView struct {
	Kind      models.StepKind `json:"kind"`
	DueAt     time.Time       `json:"due_at"`
	Hard      bool            `json:"hard"`
	LateCount *int            `json:"late_count,omitempty"`
}

type OpeningView struct {
	RoleID         string         `json:"role_id"`
	RoleName       string         `json:"role_name"`
	State          State          `json:"state"`
	ReleasedAt     *time.Time     `json:"released_at,omitempty"`
	ApplicantCount int            `json:"applicant_count"`
	Deadlines      []DeadlineView `json:"deadlines"`
}

type StepView struct {
	Step           models.Step      `json:"step"`
	Label          string           `json:"label"`
	Status         Status           `json:"status"`
	CompletedAt    *time.Time       `json:"completed_at,omitempty"`
	ApplicantCount int              `json:"applicant_count"`
	Assignments    []AssignmentView `json:"assignments"`
	Openings       []OpeningView    `json:"openings"`
}

// Overview is one caller's layer of the workflow: leads see steps, deadlines and their tasks; chiefs and admins add late counts and next actions.
type Overview struct {
	CycleID     string       `json:"cycle_id"`
	Role        string       `json:"role" enum:"admin,chief,lead"`
	CurrentStep *models.Step `json:"current_step,omitempty"`
	Steps       []StepView   `json:"steps"`
	NextActions []NextAction `json:"next_actions"`
	Tasks       []Task       `json:"tasks"`
}

func loadOverview(db *gorm.DB, cycleID string, c Caller, now time.Time) (Overview, error) {
	f, err := Load(db, cycleID)
	if err != nil {
		return Overview{}, err
	}
	var late LateCounts
	if c.CanOverride() {
		if late, err = loadLate(db, cycleID); err != nil {
			return Overview{}, err
		}
	}
	if c.CanOverride() {
		if err := f.LoadSetup(db); err != nil {
			return Overview{}, err
		}
	}
	counts, err := loadTaskCounts(db, cycleID, c.NUID)
	if err != nil {
		return Overview{}, err
	}
	return f.Overview(c, now, late, counts), nil
}

func (f *CycleState) assignmentViews(s models.Step) []AssignmentView {
	out := []AssignmentView{}
	t, _ := TypeOf(s)
	for _, k := range t.AssignmentKinds {
		if n, ok := f.Assignments[s][k]; ok {
			out = append(out, AssignmentView{Kind: k, PerApplicant: n})
		}
	}
	return out
}

func (f *CycleState) StepConfigs() []StepConfig {
	out := make([]StepConfig, 0, len(f.Order))
	for _, s := range f.Order {
		out = append(out, StepConfig{Step: s, Label: Label(s), Enabled: f.Enabled[s], CompletedAt: f.CompletedAt[s], Assignments: f.assignmentViews(s)})
	}
	return out
}

type LateCounts map[key]map[models.StepKind]int

func (f *CycleState) Overview(c Caller, now time.Time, late LateCounts, counts []TaskCount) Overview {
	v := Overview{CycleID: f.CycleID, Role: c.Tier.role(), Steps: []StepView{}, NextActions: []NextAction{}, Tasks: f.Tasks(counts)}
	if c.CanOverride() {
		v.NextActions = f.NextActions(now)
	}
	if cur, ok := f.Current(); ok {
		v.CurrentStep = &cur
	}
	for _, s := range f.EnabledSteps() {
		sv := StepView{Step: s, Label: Label(s), Status: f.StepStatus(s), CompletedAt: f.CompletedAt[s], ApplicantCount: f.StepCount(s), Assignments: f.assignmentViews(s), Openings: []OpeningView{}}
		for _, o := range f.Openings {
			ov := OpeningView{RoleID: o.RoleID, RoleName: o.Name, State: f.State(o.RoleID, s, now), ApplicantCount: f.Count(o.RoleID, s), Deadlines: []DeadlineView{}}
			if at, ok := f.ReleasedAt(o.RoleID, s); ok {
				ov.ReleasedAt = &at
			}
			t, _ := TypeOf(s)
			for _, k := range t.DeadlineKinds {
				d, ok := f.Deadline(o.RoleID, s, k)
				if !ok {
					continue
				}
				dv := DeadlineView{Kind: k, DueAt: d.DueAt, Hard: d.Hard}
				if n, ok := late[key{o.RoleID, s}][k]; ok {
					dv.LateCount = &n
				}
				ov.Deadlines = append(ov.Deadlines, dv)
			}
			sv.Openings = append(sv.Openings, ov)
		}
		v.Steps = append(v.Steps, sv)
	}
	return v
}

func loadLate(db *gorm.DB, cycleID string) (LateCounts, error) {
	late := LateCounts{}
	deadline := "JOIN opening_deadlines d ON d.cycle_id = a.cycle_id AND d.role_id = a.role_id AND d.step = ? AND d.kind = ?"
	var rows []struct {
		Step   models.Step
		Kind   models.StepKind
		RoleID string
		N      int
	}
	err := db.Raw("? UNION ALL ?",
		db.Table("applications a").Select("? AS step, ? AS kind, a.role_id, count(*) AS n", models.StepApplications, models.KindApplicant).
			Joins(deadline, models.StepApplications, models.KindApplicant).
			Where("a.cycle_id = ? AND a.submitted_at > d.due_at", cycleID).Group("a.role_id"),
		db.Table("written_reviews w").Select("? AS step, ? AS kind, a.role_id, count(*) AS n", models.StepReviews, models.KindReviewer).
			Joins("JOIN applications a ON a.id = w.application_id").
			Joins(deadline, models.StepReviews, models.KindReviewer).
			Where("a.cycle_id = ? AND w.submitted_at > d.due_at", cycleID).Group("a.role_id"),
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		k := key{r.RoleID, r.Step}
		if late[k] == nil {
			late[k] = map[models.StepKind]int{}
		}
		late[k][r.Kind] = r.N
	}
	return late, nil
}

// loadTaskCounts is empty for anyone off the cycle's staff, even if work was assigned to them.
func loadTaskCounts(db *gorm.DB, cycleID, nuid string) ([]TaskCount, error) {
	out := []TaskCount{}
	if in, err := InStaffPool(db, cycleID, nuid); err != nil || !in {
		return out, err
	}
	err := db.Raw("? UNION ALL ? UNION ALL ? UNION ALL ? UNION ALL ? UNION ALL ?",
		db.Table("lead_assignments la").
			Select("? AS kind, a.role_id::text AS role_id, count(*) AS total, count(w.submitted_at) AS done", TaskReview).
			Joins("JOIN applications a ON a.id = la.application_id").
			Joins("LEFT JOIN written_reviews w ON w.application_id = la.application_id AND w.reviewer_nuid = la.lead_nuid").
			Where("a.cycle_id = ? AND la.lead_nuid = ?", cycleID, nuid).Group("a.role_id"),
		db.Table("interviewers x").
			Select("? AS kind, a.role_id::text AS role_id, count(*) AS total, count(i.submitted_at) AS done", TaskInterview).
			Joins("JOIN interviews i ON i.id = x.interview_id").
			Joins("JOIN applications a ON a.id = i.application_id").
			Where("a.cycle_id = ? AND x.interviewer_nuid = ?", cycleID, nuid).Group("a.role_id"),
		db.Table("interview_reviewers r").
			Select("? AS kind, a.role_id::text AS role_id, count(*) AS total, count(r.writeup_submitted_at) AS done", TaskRecordingReview).
			Joins("JOIN interviews i ON i.id = r.interview_id").
			Joins("JOIN applications a ON a.id = i.application_id").
			Where("a.cycle_id = ? AND r.reviewer_nuid = ?", cycleID, nuid).Group("a.role_id"),
		db.Table("preference_list_members m").
			Select("? AS kind, '' AS role_id, count(*) AS total, count(*) FILTER (WHERE pl.status = ?) AS done", TaskPreferenceList, models.PreferenceListSubmitted).
			Joins("JOIN preference_lists pl ON pl.id = m.preference_list_id").
			Where("pl.cycle_id = ? AND m.lead_nuid = ?", cycleID, nuid).Having("count(*) > 0"),
		db.Table("drafts d").
			Select("? AS kind, d.role_id::text AS role_id, count(DISTINCT d.id) AS total, count(DISTINCT d.id) FILTER (WHERE d.status = 'complete') AS done", TaskDraft).
			Joins("JOIN draft_teams t ON t.draft_id = d.id").
			Joins("JOIN preference_list_members m ON m.preference_list_id = t.preference_list_id").
			Where("d.cycle_id = ? AND m.lead_nuid = ? AND d.status <> 'setup'", cycleID, nuid).Group("d.role_id"),
		db.Table("applications a").
			Select(`? AS kind, a.role_id::text AS role_id, count(DISTINCT a.id) AS total, count(DISTINCT a.id) FILTER (WHERE dd.sent_at IS NOT NULL
				OR COALESCE(dd.body_override, '') <> ''
				OR (COALESCE(dd.feedback, '') <> '' AND COALESCE(dd.compliments, '') <> '')) AS done`, TaskFeedback).
			Joins("JOIN interviews i ON i.application_id = a.id").
			Joins("JOIN interviewers x ON x.interview_id = i.id").
			Joins("LEFT JOIN decision_drafts dd ON dd.application_id = a.id AND dd.kind = ?", models.DecisionRejectionPostInterview).
			Where("a.cycle_id = ? AND a.stage = ? AND x.interviewer_nuid = ?", cycleID, models.StageRejected, nuid).Group("a.role_id"),
	).Scan(&out).Error
	return out, err
}

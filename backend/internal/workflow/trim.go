package workflow

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type assignedRow struct {
	ID            string
	ApplicationID string
	Applicant     string
	Person        string
	AssignedAt    time.Time
	Started       bool
}

var assignmentTables = map[models.StepKind]string{
	models.KindReviewer:          "lead_assignments",
	models.KindInterviewer:       "interviewers",
	models.KindRecordingReviewer: "interview_reviewers",
}

var assignmentQueries = map[models.StepKind]struct{ from, sel string }{
	models.KindReviewer: {
		from: "lead_assignments x JOIN applications a ON a.id = x.application_id",
		sel: `x.id, x.application_id, x.lead_nuid AS person, x.assigned_at,
			EXISTS (SELECT 1 FROM written_reviews w WHERE w.application_id = x.application_id AND w.reviewer_nuid = x.lead_nuid) AS started`,
	},
	models.KindInterviewer: {
		from: "interviewers x JOIN interviews i ON i.id = x.interview_id JOIN applications a ON a.id = i.application_id",
		sel: `x.id, i.application_id, x.interviewer_nuid AS person, x.assigned_at,
			(i.submitted_at IS NOT NULL OR COALESCE(i.writeup, '') <> '') AS started`,
	},
	models.KindRecordingReviewer: {
		from: "interview_reviewers x JOIN interviews i ON i.id = x.interview_id JOIN applications a ON a.id = i.application_id",
		sel:  `x.id, i.application_id, x.reviewer_nuid AS person, x.assigned_at, COALESCE(x.writeup, '') <> '' AS started`,
	},
}

func assignedRows(tx *gorm.DB, cycleID string, s models.Step, k models.StepKind) ([]assignedRow, error) {
	q, ok := assignmentQueries[k]
	if !ok {
		return nil, nil
	}
	var rows []assignedRow
	err := tx.Table(q.from).Select(q.sel+", u.full_name AS applicant").
		Joins("JOIN users u ON u.nuid = a.user_nuid").
		Where("a.cycle_id = ? AND a.stage IN ?", cycleID, Stages(s)).
		Order("x.assigned_at DESC").Scan(&rows).Error
	return rows, err
}

// planTrim removes the newest unstarted assignments above want; started work is never removed, so those applicants stay over.
func planTrim(tx *gorm.DB, f *CycleState, s models.Step, k models.StepKind, want int, p *Preview) error {
	rows, err := assignedRows(tx, f.CycleID, s, k)
	if err != nil {
		return err
	}
	byApp := map[string][]assignedRow{}
	var order []string
	for _, r := range rows {
		if _, ok := byApp[r.ApplicationID]; !ok {
			order = append(order, r.ApplicationID)
		}
		byApp[r.ApplicationID] = append(byApp[r.ApplicationID], r)
	}
	over := 0
	for _, app := range order {
		extra := len(byApp[app]) - want
		for _, r := range byApp[app] {
			if extra <= 0 {
				break
			}
			if r.Started {
				continue
			}
			p.Changes = append(p.Changes, PreviewItem{ID: r.ID, Kind: "unassign", ApplicationID: app, Applicant: r.Applicant, Person: r.Person})
			extra--
		}
		if extra > 0 {
			over++
			for _, r := range byApp[app] {
				if r.Started {
					p.Kept = append(p.Kept, PreviewItem{Kind: "kept_started", ApplicationID: app, Applicant: r.Applicant, Person: r.Person})
				}
			}
		}
	}
	if len(p.Changes) > 0 {
		p.Raise(LevelDestructive)
		p.Say(fmt.Sprintf("%d %s assignment(s) with nothing started will be removed", len(p.Changes), k))
	}
	if over > 0 {
		p.Say(fmt.Sprintf("%d applicant(s) keep more than %d because their work has started", over, want))
	}
	return nil
}

func removeAssignments(tx *gorm.DB, k models.StepKind, items []PreviewItem) error {
	ids := make([]string, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.ID)
	}
	if len(ids) == 0 {
		return nil
	}
	return tx.Table(assignmentTables[k]).Where("id IN ?", ids).Delete(nil).Error
}

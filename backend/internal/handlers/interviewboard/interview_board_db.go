package interviewboard

import (
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func boardApplicants(db *gorm.DB, cycleID, roleID string, history bool, limit int, after *utils.Cursor) ([]InterviewBoardRow, string, error) {
	rows := []InterviewBoardRow{}
	q := db.Table("applications a").
		Select("a.id AS application_id, a.user_nuid AS applicant_nuid, COALESCE(u.full_name, a.user_nuid) AS full_name, COALESCE(u.email, '') AS email, a.role_id, a.stage").
		Joins("LEFT JOIN users u ON u.nuid = a.user_nuid").
		Where("a.cycle_id = ?", cycleID).
		Order("full_name").Order("a.id")
	if history {
		q = q.Where("a.stage IN ? OR EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id)", interviewStages)
	} else {
		q = q.Where("a.stage IN ?", interviewStages)
	}
	if roleID != "" {
		q = q.Where("a.role_id = ?", roleID)
	}
	if limit > 0 {
		if after != nil {
			q = q.Where("(COALESCE(u.full_name, a.user_nuid), a.id) > (?, ?::uuid)", after.Text, after.ID)
		}
		q = q.Limit(limit + 1)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, "", err
	}
	rows, more := utils.TrimPage(rows, limit)
	if !more {
		return rows, "", nil
	}
	last := rows[len(rows)-1]
	return rows, utils.Cursor{Text: last.FullName, ID: last.ApplicationID}.Encode(), nil
}

type boardPersonRow struct {
	InterviewBoardPerson
	ApplicationID string
}

func boardPeople(db *gorm.DB, table, nuidCol, doneExpr string, ids []string) (map[string][]InterviewBoardPerson, error) {
	var rows []boardPersonRow
	err := db.Table(table+" x").
		Select("x.id AS assignment_id, i.application_id, x."+nuidCol+" AS nuid, COALESCE(u.full_name, x."+nuidCol+") AS full_name, "+doneExpr+" AS done").
		Joins("JOIN interviews i ON i.id = x.interview_id").
		Joins("LEFT JOIN users u ON u.nuid = x."+nuidCol).
		Where("i.application_id IN ?", ids).Order("x.assigned_at").Order("x.id").Scan(&rows).Error
	out := map[string][]InterviewBoardPerson{}
	for _, r := range rows {
		out[r.ApplicationID] = append(out[r.ApplicationID], r.InterviewBoardPerson)
	}
	return out, err
}

type interviewState struct {
	ApplicationID string
	ScheduledAt   *time.Time
	Started       bool
	Done          bool
}

func interviewStates(db *gorm.DB, ids []string) (map[string]interviewState, error) {
	var rows []interviewState
	err := db.Table("interviews i").
		Select(`i.application_id, i.scheduled_at,
			(i.writeup IS NOT NULL OR i.rating IS NOT NULL OR i.notes_url IS NOT NULL) AS started,
			i.submitted_at IS NOT NULL AS done`).
		Where("i.application_id IN ?", ids).Scan(&rows).Error
	out := make(map[string]interviewState, len(rows))
	for _, r := range rows {
		out[r.ApplicationID] = r
	}
	return out, err
}

func applicationSlots(db *gorm.DB, ids []string) (map[string][]string, error) {
	var rows []models.ApplicationSlot
	out := map[string][]string{}
	if len(ids) == 0 {
		return out, nil
	}
	err := db.Table("application_slots s").Select("s.application_id, s.slot_id").
		Joins("JOIN meeting_slots m ON m.id = s.slot_id").
		Where("s.application_id IN ?", ids).Order("m.position").Scan(&rows).Error
	for _, r := range rows {
		out[r.ApplicationID] = append(out[r.ApplicationID], r.SlotID)
	}
	return out, err
}

func staffSlots(db *gorm.DB, cycleID string) (map[string]string, error) {
	var rows []models.StaffSlot
	err := db.Where("cycle_id = ?", cycleID).Find(&rows).Error
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.UserNUID] = r.SlotID
	}
	return out, err
}

func staffNames(db *gorm.DB, cycleID string) (map[string]string, error) {
	var rows []struct{ NUID, FullName string }
	err := db.Table("(?) AS p", workflow.StaffPool(db, cycleID)).Select("p.user_nuid AS nuid, u.full_name").
		Joins("JOIN users u ON u.nuid = p.user_nuid").Scan(&rows).Error
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.NUID] = r.FullName
	}
	return out, err
}

func plannableIDs(db *gorm.DB, cycleID string) ([]string, error) {
	var ids []string
	err := db.Model(&models.Application{}).Where("cycle_id = ? AND stage IN ?", cycleID, interviewStages).
		Order("id").Pluck("id", &ids).Error
	return ids, err
}

func cycleRoles(db *gorm.DB, cycleID string) ([]string, error) {
	var ids []string
	err := db.Model(&models.Role{}).Where("cycle_id = ?", cycleID).Order("id").Pluck("id", &ids).Error
	return ids, err
}

func matchBySlot(db *gorm.DB, cycleID string) (bool, error) {
	var on []bool
	err := db.Model(&models.Cycle{}).Where("id = ?", cycleID).Pluck("match_by_slot", &on).Error
	return len(on) > 0 && on[0], err
}

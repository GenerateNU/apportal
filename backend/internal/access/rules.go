// Package access decides what a caller may do with a cycle's data: admins by
// global role, leads and chiefs by their place on that cycle's staff.
package access

import (
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// Level is how much of a cycle's data the caller may touch. Order matters:
// checks compare levels with < and >=.
type Level int

const (
	None   Level = iota
	Review       // read applications and write reviews
	Manage       // also set up forms and run the pipeline
)

type rule struct {
	types    []models.ApplicationType
	statuses []models.CycleStatus
	level    Level
}

// Nobody sees applications for their own level or above.
var (
	adminRule = rule{
		types:    []models.ApplicationType{models.ApplicationTypeMember, models.ApplicationTypeLead, models.ApplicationTypeChief},
		statuses: []models.CycleStatus{models.CycleDraft, models.CycleOpen},
		level:    Manage,
	}
	staffRules = []struct {
		role models.CycleStaffRole
		rule
	}{
		{models.CycleStaffChief, rule{
			types:    []models.ApplicationType{models.ApplicationTypeMember, models.ApplicationTypeLead},
			statuses: []models.CycleStatus{models.CycleDraft, models.CycleOpen},
			level:    Manage,
		}},
		{models.CycleStaffLead, rule{
			types:    []models.ApplicationType{models.ApplicationTypeMember},
			statuses: []models.CycleStatus{models.CycleOpen},
			level:    Review,
		}},
	}
)

func (r rule) grants(status models.CycleStatus, t models.ApplicationType) Level {
	if slices.Contains(r.statuses, status) && slices.Contains(r.types, t) {
		return r.level
	}
	return None
}

// LevelFor applies the rules to one caller and cycle. staff is "" when the
// caller isn't on the cycle's staff.
func LevelFor(admin bool, staff models.CycleStaffRole, status models.CycleStatus, t models.ApplicationType) Level {
	if admin {
		return adminRule.grants(status, t)
	}
	for _, s := range staffRules {
		if s.role == staff {
			return s.grants(status, t)
		}
	}
	return None
}

// StaffRolesFor lists the staff roles that get any access to a cycle of type t,
// chiefs first. Staffing anyone else there would grant nothing.
func StaffRolesFor(t models.ApplicationType) []models.CycleStaffRole {
	var roles []models.CycleStaffRole
	for _, s := range staffRules {
		if slices.Contains(s.types, t) {
			roles = append(roles, s.role)
		}
	}
	return roles
}

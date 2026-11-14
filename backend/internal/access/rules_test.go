package access

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const (
	member = models.ApplicationTypeMember
	lead   = models.ApplicationTypeLead
	chief  = models.ApplicationTypeChief
	open   = models.CycleOpen
	draft  = models.CycleDraft
	closed = models.CycleClosed
)

func TestLevelFor(t *testing.T) {
	cases := []struct {
		name   string
		admin  bool
		staff  models.CycleStaffRole
		status models.CycleStatus
		typ    models.ApplicationType
		want   Level
	}{
		// Admin: every type, but only draft and open cycles.
		{"admin open chief cycle", true, "", open, chief, Manage},
		{"admin draft cycle", true, "", draft, member, Manage},
		{"admin closed cycle", true, "", closed, member, None},
		{"admin archived cycle", true, "", models.CycleArchived, member, None},

		// Chief: member and lead cycles, draft or open.
		{"chief member cycle", false, models.CycleStaffChief, open, member, Manage},
		{"chief lead cycle", false, models.CycleStaffChief, open, lead, Manage},
		{"chief chief cycle", false, models.CycleStaffChief, open, chief, None},
		{"chief draft cycle", false, models.CycleStaffChief, draft, member, Manage},
		{"chief archived cycle", false, models.CycleStaffChief, models.CycleArchived, lead, None},
		{"chief closed cycle", false, models.CycleStaffChief, closed, member, None},

		// Lead: member cycles, open only, review only.
		{"lead member cycle", false, models.CycleStaffLead, open, member, Review},
		{"lead lead cycle", false, models.CycleStaffLead, open, lead, None},
		{"lead chief cycle", false, models.CycleStaffLead, open, chief, None},
		{"lead closed cycle", false, models.CycleStaffLead, closed, member, None},
		{"lead draft cycle", false, models.CycleStaffLead, draft, member, None},

		{"not on staff", false, "", open, member, None},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := LevelFor(tc.admin, tc.staff, tc.status, tc.typ); got != tc.want {
				t.Errorf("LevelFor = %v, want %v", got, tc.want)
			}
		})
	}
}

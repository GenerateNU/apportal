package cyclestaff

import (
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestCycleStaffQueries(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var rows []models.CycleStaffMember
	list := staffQuery(db, "c1", "").Find(&rows).Statement
	leads := staffQuery(db, "c1", models.CycleStaffLead).Find(&rows).Statement
	cp := copyPreviousCycleStaff(db, "c2").Statement

	cases := []struct {
		name     string
		sql      string
		args     []any
		wantSQL  []string
		wantArgs []any
	}{
		{
			name:     "list joins users, chiefs first",
			sql:      list.SQL.String(),
			args:     list.Vars,
			wantSQL:  []string{`JOIN users u ON u.nuid = cs.user_nuid`, `cs.cycle_id = $1`, `ORDER BY cs.role DESC,u.full_name`},
			wantArgs: []any{"c1"},
		},
		{
			name:     "list one role",
			sql:      leads.SQL.String(),
			args:     leads.Vars,
			wantSQL:  []string{`cs.cycle_id = $1`, `cs.role = $2`},
			wantArgs: []any{"c1", models.CycleStaffLead},
		},
		{
			name: "copy the latest earlier cycle of the same branch and type",
			sql:  cp.SQL.String(),
			args: cp.Vars,
			wantSQL: []string{
				`INSERT INTO cycle_staff (cycle_id, user_nuid, role)`,
				`JOIN cycles n ON n.id = $2`,
				`c.branch_id = n.branch_id AND c.application_type = n.application_type AND c.id <> n.id`,
				`ORDER BY c.created_at DESC LIMIT 1`,
			},
			wantArgs: []any{"c2", "c2"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, want := range tc.wantSQL {
				if !strings.Contains(tc.sql, want) {
					t.Errorf("sql missing %q:\n%s", want, tc.sql)
				}
			}
			if !reflect.DeepEqual(tc.args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", tc.args, tc.wantArgs)
			}
		})
	}
}

package role

import (
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestRoleQueries(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}

	var n int64
	count := cycleRole(db, "c1", "r1").Count(&n).Statement
	var roles []models.Role
	list := rolesQuery(db, "c1").Find(&roles).Statement
	all := rolesQuery(db, "").Find(&roles).Statement
	cp := copyPreviousCycleRoles(db, "c2").Statement

	cases := []struct {
		name     string
		sql      string
		args     []any
		wantSQL  []string
		wantArgs []any
	}{
		{
			name:     "has role",
			sql:      count.SQL.String(),
			args:     count.Vars,
			wantSQL:  []string{`SELECT count(*) FROM "roles"`, `cycle_id = $1`, `id = $2`},
			wantArgs: []any{"c1", "r1"},
		},
		{
			name:     "list one cycle, in order",
			sql:      list.SQL.String(),
			args:     list.Vars,
			wantSQL:  []string{`cycle_id = $1`, `ORDER BY created_at,name`},
			wantArgs: []any{"c1"},
		},
		{
			name:     "list every cycle",
			sql:      all.SQL.String(),
			args:     all.Vars,
			wantSQL:  []string{`SELECT * FROM "roles" ORDER BY created_at,name`},
			wantArgs: []any{},
		},
		{
			name: "copy the latest earlier cycle of the same branch and type, keeping order",
			sql:  cp.SQL.String(),
			args: cp.Vars,
			wantSQL: []string{
				`INSERT INTO roles (cycle_id, name, created_at)`,
				`ORDER BY r.created_at, r.name`,
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

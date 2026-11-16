package applicationtemplate

import (
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestCycleTemplateQueries(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var rows []models.ApplicationTemplate
	list := cycleTemplatesQuery(db, "c1").Find(&rows).Statement
	missing := createMissingCycleTemplates(db, "c1").Statement

	cases := []struct {
		name     string
		sql      string
		args     []any
		wantSQL  []string
		wantArgs []any
	}{
		{
			name:     "list one cycle's templates in role order",
			sql:      list.SQL.String(),
			args:     list.Vars,
			wantSQL:  []string{`JOIN roles r ON r.id = at.role_id`, `at.cycle_id = $1`, `ORDER BY r.created_at`},
			wantArgs: []any{"c1"},
		},
		{
			name: "create a default-titled template for each role without one",
			sql:  missing.SQL.String(),
			args: missing.Vars,
			wantSQL: []string{
				`INSERT INTO application_templates (cycle_id, role_id, title)`,
				`SELECT r.cycle_id, r.id, r.name || ' Application'`,
				`WHERE r.cycle_id = $1`,
				`ON CONFLICT DO NOTHING`,
			},
			wantArgs: []any{"c1"},
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

package cycle

import (
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func cyclesSQL(t *testing.T, f CycleFilter) (string, []any) {
	t.Helper()
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var cycles []models.Cycle
	stmt := cyclesQuery(db, f).Find(&cycles).Statement
	return stmt.SQL.String(), stmt.Vars
}

func TestCyclesQueryFilters(t *testing.T) {
	cases := []struct {
		name     string
		filter   CycleFilter
		wantSQL  []string
		wantArgs []any
	}{
		{name: "no filters", filter: CycleFilter{}, wantArgs: []any{}},
		{
			name:     "branch only",
			filter:   CycleFilter{BranchID: "b1"},
			wantSQL:  []string{`branch_id = $1`},
			wantArgs: []any{"b1"},
		},
		{
			name:     "status and branch",
			filter:   CycleFilter{Status: models.CycleOpen, BranchID: "b1"},
			wantSQL:  []string{`status = $1`, `branch_id = $2`},
			wantArgs: []any{models.CycleOpen, "b1"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sql, args := cyclesSQL(t, tc.filter)
			for _, want := range tc.wantSQL {
				if !strings.Contains(sql, want) {
					t.Errorf("sql missing %q:\n%s", want, sql)
				}
			}
			if len(tc.wantSQL) == 0 && strings.Contains(sql, "WHERE") {
				t.Errorf("unexpected WHERE:\n%s", sql)
			}
			if !reflect.DeepEqual(args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", args, tc.wantArgs)
			}
		})
	}
}

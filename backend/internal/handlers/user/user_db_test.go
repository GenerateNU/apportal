package user

import (
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestUserQueries(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	admin := models.UserRoleAdmin
	lead := models.CycleStaffLead
	var users []models.User
	all := usersQuery(db, userFilter{}).Find(&users).Statement
	admins := usersQuery(db, userFilter{UserRole: &admin}).Find(&users).Statement
	leads := usersQuery(db, userFilter{StaffRole: &lead}).Find(&users).Statement

	cases := []struct {
		name     string
		sql      string
		args     []any
		wantSQL  []string
		skipSQL  []string
		wantArgs []any
	}{
		{
			name:    "everyone, by name",
			sql:     all.SQL.String(),
			args:    all.Vars,
			wantSQL: []string{`ORDER BY full_name`},
			skipSQL: []string{`ANY(roles)`, `cycle_staff`},
		},
		{
			name:     "a global role",
			sql:      admins.SQL.String(),
			args:     admins.Vars,
			wantSQL:  []string{`$1 = ANY(roles)`},
			wantArgs: []any{"admin"},
		},
		{
			name:     "staff with a role on any cycle",
			sql:      leads.SQL.String(),
			args:     leads.Vars,
			wantSQL:  []string{`EXISTS (SELECT 1 FROM cycle_staff cs WHERE cs.user_nuid = users.nuid AND cs.role = $1)`},
			wantArgs: []any{models.CycleStaffLead},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, want := range tc.wantSQL {
				if !strings.Contains(tc.sql, want) {
					t.Errorf("sql missing %q:\n%s", want, tc.sql)
				}
			}
			for _, skip := range tc.skipSQL {
				if strings.Contains(tc.sql, skip) {
					t.Errorf("sql should not contain %q:\n%s", skip, tc.sql)
				}
			}
			if len(tc.wantArgs) > 0 && !reflect.DeepEqual(tc.args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", tc.args, tc.wantArgs)
			}
		})
	}
}

func TestParseUserFilter(t *testing.T) {
	cases := []struct {
		in      string
		want    userFilter
		wantErr bool
	}{
		{"", userFilter{}, false},
		{"admin", userFilter{UserRole: ptr(models.UserRoleAdmin)}, false},
		{"applicant", userFilter{UserRole: ptr(models.UserRoleApplicant)}, false},
		{"lead", userFilter{StaffRole: ptr(models.CycleStaffLead)}, false},
		{"chief", userFilter{StaffRole: ptr(models.CycleStaffChief)}, false},
		{"member", userFilter{}, true},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			got, err := parseUserFilter(tc.in)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func ptr[T any](v T) *T { return &v }

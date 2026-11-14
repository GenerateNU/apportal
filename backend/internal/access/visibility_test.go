package access

import (
	"context"
	"net/http"
	"reflect"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestVisibleCycleIDsSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	staffReview := visibleCycleIDs(db, false, "u1", Review).Find(&ids).Statement
	staffManage := visibleCycleIDs(db, false, "u1", Manage).Find(&ids).Statement
	admin := visibleCycleIDs(db, true, "u1", Review).Find(&ids).Statement

	cases := []struct {
		name     string
		sql      string
		args     []any
		wantSQL  []string
		absent   []string
		wantArgs []any
	}{
		{
			name: "staff reading: cycles where their role sees the type and status",
			sql:  staffReview.SQL.String(),
			args: staffReview.Vars,
			wantSQL: []string{
				`JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = $1`,
				`(cs.role = $2 AND c.application_type IN ($3,$4) AND c.status IN ($5,$6))`,
				`(cs.role = $7 AND c.application_type IN ($8) AND c.status IN ($9))`,
			},
			wantArgs: []any{"u1", models.CycleStaffChief, member, lead, draft, open, models.CycleStaffLead, member, open},
		},
		{
			name:     "staff managing: only the chief rule",
			sql:      staffManage.SQL.String(),
			args:     staffManage.Vars,
			wantSQL:  []string{`(cs.role = $2 AND c.application_type IN ($3,$4) AND c.status IN ($5,$6))`},
			absent:   []string{`$7`},
			wantArgs: []any{"u1", models.CycleStaffChief, member, lead, draft, open},
		},
		{
			name:     "admin: every draft or open cycle, no staff join",
			sql:      admin.SQL.String(),
			args:     admin.Vars,
			wantSQL:  []string{`c.status IN ($1,$2)`, `c.application_type IN ($3,$4,$5)`},
			absent:   []string{`cycle_staff`},
			wantArgs: []any{draft, open, member, lead, chief},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, want := range tc.wantSQL {
				if !strings.Contains(tc.sql, want) {
					t.Errorf("sql missing %q:\n%s", want, tc.sql)
				}
			}
			for _, bad := range tc.absent {
				if strings.Contains(tc.sql, bad) {
					t.Errorf("sql has %q:\n%s", bad, tc.sql)
				}
			}
			if !reflect.DeepEqual(tc.args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", tc.args, tc.wantArgs)
			}
		})
	}
}

func TestVisibleApplicationIDsSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	st := visibleApplicationIDs(db, false, "u1", []string{"a1", "a2"}, Review).Find(&ids).Statement
	for _, want := range []string{
		`SELECT "id" FROM "applications" WHERE id IN ($1,$2) AND cycle_id IN (SELECT c.id FROM cycles c JOIN cycle_staff cs`,
		`cs.user_nuid = $3`,
	} {
		if !strings.Contains(st.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, st.SQL.String())
		}
	}
}

func TestVisibleApplicationIDsWithoutActor(t *testing.T) {
	c := &Checker{}
	_, err := c.VisibleApplicationIDs(context.Background(), []string{"a1"}, Review)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
	if ids, err := c.VisibleApplicationIDs(testutil.WithActor(middleware.Actor{NUID: "u1"}), nil, Review); err != nil || len(ids) != 0 {
		t.Errorf("no ids should skip the query: %v %v", ids, err)
	}
}

func TestApplicantAndStaffChecksWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireApplicant(context.Background(), "u9", Review), http.StatusUnauthorized)
	testutil.WantStatus(t, c.RequireAnyCycle(context.Background(), Review), http.StatusUnauthorized)
}

func TestListableCyclesSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	if listableCycles(db, true, "a1") != nil {
		t.Error("admins should see every cycle")
	}

	var cycles []models.Cycle
	signedOut := db.Where(listableCycles(db, false, "")).Find(&cycles).Statement
	if got := signedOut.SQL.String(); !strings.Contains(got, `status = $1`) || strings.Contains(got, "applications") {
		t.Errorf("signed out should see open cycles only:\n%s", got)
	}

	user := db.Where(listableCycles(db, false, "u1")).Find(&cycles).Statement
	for _, want := range []string{
		`status = $1`,
		`OR id IN (SELECT "cycle_id" FROM "applications" WHERE user_nuid = $2)`,
		`OR id IN (SELECT c.id FROM cycles c JOIN cycle_staff cs ON cs.cycle_id = c.id AND cs.user_nuid = $3`,
	} {
		if !strings.Contains(user.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, user.SQL.String())
		}
	}

	combined := db.Where("branch_id = ?", "b1").Where(listableCycles(db, false, "u1")).Find(&cycles).Statement
	if !strings.Contains(combined.SQL.String(), `branch_id = $1 AND (status = $2 OR`) {
		t.Errorf("the OR group must stay parenthesised:\n%s", combined.SQL.String())
	}
}

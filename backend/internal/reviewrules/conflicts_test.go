package reviewrules

import (
	"strings"
	"testing"

	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
)

func TestConflictQueries(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var rows []Conflict
	list := listQuery(db, "c1").Scan(&rows).Statement
	var pairs []struct{ ApplicationID, LeadNUID string }
	blocked := blockedQuery(db, "c1").Scan(&pairs).Statement
	var n int64
	one := conflictedQuery(db, "a1", "l1").Count(&n).Statement

	cases := []struct {
		name string
		sql  string
		want []string
	}{
		{"list joins both names in one query", list.SQL.String(), []string{"JOIN users l ON l.nuid = rc.lead_nuid", "JOIN users a ON a.nuid = rc.applicant_nuid", "rc.cycle_id = $1"}},
		{"blocked maps people to every application they made in the cycle", blocked.SQL.String(), []string{"JOIN applications a ON a.cycle_id = rc.cycle_id AND a.user_nuid = rc.applicant_nuid", "rc.cycle_id = $1"}},
		{"conflicted stays inside the application's cycle", one.SQL.String(), []string{"a.cycle_id = rc.cycle_id", "a.id = $1 AND rc.lead_nuid = $2"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, w := range tc.want {
				if !strings.Contains(tc.sql, w) {
					t.Errorf("sql missing %q:\n%s", w, tc.sql)
				}
			}
		})
	}
}

func TestPutConflictIsIdempotent(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	sql := put(db.Session(&gorm.Session{SkipDefaultTransaction: true}), "c1", "l1", "u1").Statement.SQL.String()
	if !strings.Contains(sql, "ON CONFLICT DO NOTHING") {
		t.Errorf("a repeat put must be a no-op:\n%s", sql)
	}
}

func TestBlockedMerge(t *testing.T) {
	a := Blocked{}
	a.Add("app1", "x")
	b := Blocked{}
	b.Add("app1", "y")
	b.Add("app2", "x")
	got := a.Merge(b)
	if !got["app1"]["x"] || !got["app1"]["y"] || !got["app2"]["x"] || got["app2"]["y"] {
		t.Errorf("merge: %v", got)
	}
}

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

func TestRequireLevel(t *testing.T) {
	cases := []struct {
		name string
		have Level
		want Level
		code int
	}{
		{"hidden cycle reads as missing", None, Review, http.StatusNotFound},
		{"reviewer asking to manage", Review, Manage, http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.WantStatus(t, RequireLevel(tc.have, tc.want), tc.code)
		})
	}
	if err := RequireLevel(Manage, Review); err != nil {
		t.Errorf("manager reading: %v", err)
	}
}

func TestRequireAdmin(t *testing.T) {
	testutil.WantStatus(t, RequireAdmin(context.Background()), http.StatusUnauthorized)
	applicant := middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}}
	testutil.WantStatus(t, RequireAdmin(testutil.WithActor(applicant)), http.StatusForbidden)
	admin := middleware.Actor{NUID: "a2", Roles: []models.UserRole{models.UserRoleAdmin}}
	if err := RequireAdmin(testutil.WithActor(admin)); err != nil {
		t.Errorf("admin: %v", err)
	}
}

func TestRequireCycleWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireCycle(context.Background(), "c1", Review), http.StatusUnauthorized)
}

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

func TestApplicantAndStaffChecksWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireApplicant(context.Background(), "u9", Review), http.StatusUnauthorized)
	testutil.WantStatus(t, c.RequireAnyCycle(context.Background(), Review), http.StatusUnauthorized)
}

func TestRowChecksWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireCycleOf(context.Background(), "questions", "q1", Manage), http.StatusUnauthorized)
	testutil.WantStatus(t, c.RequireApplicationOf(context.Background(), "interviews", "i1", Review), http.StatusUnauthorized)
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

func TestRequireFormNeedsRoleForApplicants(t *testing.T) {
	c := &Checker{}
	// Signed out and no role: nothing to check against, so it reads as missing.
	testutil.WantStatus(t, c.RequireForm(context.Background(), "c1", ""), http.StatusNotFound)
}

func TestFormVisibleSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var n int64
	open := openForm(db, "c1", "r1").Count(&n).Statement
	for _, want := range []string{`JOIN cycles c ON c.id = at.cycle_id`, `at.cycle_id = $1 AND at.role_id = $2`, `at.status = $3 AND c.status = $4`} {
		if !strings.Contains(open.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, open.SQL.String())
		}
	}
	mine := ownApplication(db, "c1", "r1", "u1").Count(&n).Statement
	if want := `cycle_id = $1 AND role_id = $2 AND user_nuid = $3`; !strings.Contains(mine.SQL.String(), want) {
		t.Errorf("sql missing %q:\n%s", want, mine.SQL.String())
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

func TestInterviewRowWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireInterviewRowOf(context.Background(), "interviewers", "i1", Manage), http.StatusUnauthorized)
}

func TestInterviewRowSQL(t *testing.T) {
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var f cycleFacts
	st := interviewRowCycle(db, "interviewers", "i1").Select("c.status").Take(&f).Statement
	for _, want := range []string{
		`FROM interviewers x`,
		`JOIN interviews i ON i.id = x.interview_id`,
		`JOIN applications a ON a.id = i.application_id`,
		`JOIN cycles c ON c.id = a.cycle_id`,
		`x.id = $1`,
	} {
		if !strings.Contains(st.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, st.SQL.String())
		}
	}
}

func TestApplicationLevelAtLeastWithoutActor(t *testing.T) {
	c := &Checker{}
	_, err := c.ApplicationLevelAtLeast(context.Background(), "a1", Review)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestRequireOpenFormWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireOpenForm(context.Background(), "c1", "r1"), http.StatusUnauthorized)
}

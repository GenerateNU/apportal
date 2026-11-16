package access

import (
	"context"
	"net/http"
	"strings"
	"testing"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

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
	for _, want := range []string{`JOIN cycles c ON c.id = at.cycle_id`, `JOIN opening_steps os_apps ON os_apps.cycle_id = at.cycle_id`, `os_apps.released_at IS NOT NULL`, `od_apps.due_at IS NULL OR od_apps.due_at > now() OR NOT od_apps.hard`, `c.status = `} {
		if !strings.Contains(open.SQL.String(), want) {
			t.Errorf("sql missing %q:\n%s", want, open.SQL.String())
		}
	}
	mine := ownApplication(db, "c1", "r1", "u1").Count(&n).Statement
	if want := `cycle_id = $1 AND role_id = $2 AND user_nuid = $3`; !strings.Contains(mine.SQL.String(), want) {
		t.Errorf("sql missing %q:\n%s", want, mine.SQL.String())
	}
}

func TestRequireOpenFormWithoutActor(t *testing.T) {
	c := &Checker{}
	testutil.WantStatus(t, c.RequireOpenForm(context.Background(), "c1", "r1"), http.StatusUnauthorized)
}

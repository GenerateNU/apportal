package decision

import (
	"reflect"
	"strings"
	"testing"
	"time"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// decisionsFrom backs both the list and the single-row authorization lookup,
// so these assert on its dry-run SQL.

func decisionsSQL(t *testing.T, f DecisionFilter, applicationID string) (string, []any) {
	t.Helper()
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	var rows []decisionRow
	stmt := decisionsFrom(db, f, applicationID).Scan(&rows).Statement
	return stmt.SQL.String(), stmt.Vars
}

func withExcludedStages(args ...any) []any {
	return append([]any{models.StageDraft, models.StageAccepted, models.StageWithdrawn}, args...)
}

func TestDecisionsFromFilters(t *testing.T) {
	role := models.RoleSoftwareEngineer
	kind := models.DecisionRejectionPostInterview

	cases := []struct {
		name     string
		filter   DecisionFilter
		appID    string
		wantSQL  []string
		wantArgs []any
	}{
		{
			name:   "cycle only",
			filter: DecisionFilter{CycleID: "c1"},
			wantSQL: []string{
				`a.stage NOT IN ($1,$2,$3)`,
				`a.cycle_id = $4`,
			},
			wantArgs: withExcludedStages("c1"),
		},
		{
			name:   "every filter",
			filter: DecisionFilter{CycleID: "c1", Role: &role, Kind: &kind, InterviewerNUID: "l1", Search: "dao"},
			wantSQL: []string{
				`a.cycle_id = $4`,
				`a.application_role = $5`,
				`END) = $6`,
				`COALESCE(iv.interviewer_nuid, ia.interviewer_nuid) = $7`,
				`(u.full_name ILIKE $8 ESCAPE '\'`,
			},
			wantArgs: withExcludedStages("c1", role, kind, "l1", "%dao%", "%dao%", "%dao%"),
		},
		{
			name:     "single row lookup",
			appID:    "app1",
			wantSQL:  []string{`a.id = $4`},
			wantArgs: withExcludedStages("app1"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query, args := decisionsSQL(t, tc.filter, tc.appID)
			for _, want := range tc.wantSQL {
				if !strings.Contains(query, want) {
					t.Errorf("query missing %q\ngot: %s", want, query)
				}
			}
			if !reflect.DeepEqual(args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", args, tc.wantArgs)
			}
		})
	}
}

// A search term's own LIKE metacharacters must not act as wildcards.
func TestDecisionsFromEscapesSearch(t *testing.T) {
	_, args := decisionsSQL(t, DecisionFilter{Search: "snake_case"}, "")
	if got := args[3]; got != `%snake\_case%` {
		t.Errorf("got %v, want the underscore escaped", got)
	}
}

func TestDecisionStatusFor(t *testing.T) {
	text := "written"
	empty := ""
	sent := time.Now()

	cases := []struct {
		name                                string
		kind                                models.DecisionKind
		feedback, compliments, bodyOverride *string
		sentAt                              *time.Time
		want                                models.DecisionStatus
	}{
		{
			name: "generic needs nothing filled in",
			kind: models.DecisionRejectionGeneric,
			want: models.DecisionReady,
		},
		{
			name: "post-interview waits on the interviewer",
			kind: models.DecisionRejectionPostInterview,
			want: models.DecisionPending,
		},
		{
			name:     "feedback alone is not enough",
			kind:     models.DecisionRejectionPostInterview,
			feedback: &text,
			want:     models.DecisionPending,
		},
		{
			name:        "both paragraphs make it ready",
			kind:        models.DecisionRejectionPostInterview,
			feedback:    &text,
			compliments: &text,
			want:        models.DecisionReady,
		},
		{
			name:        "an empty paragraph is not written",
			kind:        models.DecisionRejectionPostInterview,
			feedback:    &text,
			compliments: &empty,
			want:        models.DecisionPending,
		},
		{
			name:         "a hand-written override skips the paragraphs",
			kind:         models.DecisionRejectionPostInterview,
			bodyOverride: &text,
			want:         models.DecisionReady,
		},
		{
			name:   "sent wins over everything",
			kind:   models.DecisionRejectionPostInterview,
			sentAt: &sent,
			want:   models.DecisionSent,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := DecisionStatusFor(tc.kind, tc.feedback, tc.compliments, tc.bodyOverride, tc.sentAt)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

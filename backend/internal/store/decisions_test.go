package store

import (
	"strings"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// decisionsFrom hand-numbers its placeholders as filters are appended, so
// these assert the numbering lines up with the args slice — the failure a
// database-backed test would only catch at runtime.

func TestDecisionsFromPlaceholderNumbering(t *testing.T) {
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
				`AND a.stage NOT IN ('draft', 'accepted', 'withdrawn')`,
				`AND a.cycle_id = $1`,
			},
			wantArgs: []any{"c1"},
		},
		{
			name:   "every filter",
			filter: DecisionFilter{CycleID: "c1", Role: &role, Kind: &kind, InterviewerNUID: "l1", Search: "dao"},
			wantSQL: []string{
				`AND a.cycle_id = $1`,
				`AND a.application_role = $2`,
				`= $3::decision_kind`,
				`AND COALESCE(iv.interviewer_nuid, ia.interviewer_nuid) = $4`,
				`AND (u.full_name ILIKE $5 ESCAPE '\'`,
			},
			wantArgs: []any{"c1", role, kind, "l1", "%dao%"},
		},
		{
			name:     "single row lookup takes the first placeholder",
			appID:    "app1",
			wantSQL:  []string{`AND a.id = $1`},
			wantArgs: []any{"app1"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query, args := decisionsFrom(tc.filter, tc.appID)
			for _, want := range tc.wantSQL {
				if !strings.Contains(query, want) {
					t.Errorf("query missing %q\ngot: %s", want, query)
				}
			}
			if len(args) != len(tc.wantArgs) {
				t.Fatalf("got %d args %v, want %d %v", len(args), args, len(tc.wantArgs), tc.wantArgs)
			}
			for i := range args {
				if args[i] != tc.wantArgs[i] {
					t.Errorf("arg %d = %v, want %v", i+1, args[i], tc.wantArgs[i])
				}
			}
		})
	}
}

// A search term's own LIKE metacharacters must not act as wildcards.
func TestDecisionsFromEscapesSearch(t *testing.T) {
	_, args := decisionsFrom(DecisionFilter{Search: "snake_case"}, "")
	if args[0] != `%snake\_case%` {
		t.Errorf("got %v, want the underscore escaped", args[0])
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

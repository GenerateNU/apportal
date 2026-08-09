package store

import (
	"reflect"
	"strings"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// The SQL is assembled by string concatenation with hand-numbered
// placeholders, so these assert the numbering lines up with the args slice —
// the failure mode that a database-backed test would only catch at runtime.

func TestListApplicationsQueryAnswerFilters(t *testing.T) {
	cases := []struct {
		name      string
		filter    ApplicationFilter
		wantSQL   []string
		wantArgs  []any
		wantNoSQL []string
	}{
		{
			name: "contains matches answer_text case-insensitively",
			filter: ApplicationFilter{
				CycleID: "c1",
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q1", Match: MatchContains, Values: []string{"boston"}},
				},
			},
			wantSQL: []string{
				`LEFT JOIN written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id = $1`,
				`AND a.cycle_id = $2`,
				`AND (wa0.answer_text ILIKE $3 ESCAPE '\')`,
			},
			wantArgs: []any{"q1", "c1", "%boston%"},
		},
		{
			name: "checkbox matches the answer_options array",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q2", Match: MatchAnyOption, Values: []string{"Yes", "Maybe"}},
				},
			},
			wantSQL: []string{
				`AND (wa0.answer_options @> jsonb_build_array($2::text) OR wa0.answer_options @> jsonb_build_array($3::text))`,
			},
			wantArgs: []any{"q2", "Yes", "Maybe"},
		},
		{
			name: "single-choice matches answer_text exactly",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q3", Match: MatchAnyOf, Values: []string{"Fall"}},
				},
			},
			wantSQL:  []string{`AND wa0.answer_text = ANY($2::text[])`},
			wantArgs: []any{"q3", []string{"Fall"}},
		},
		{
			// Two filters get their own join each, and the placeholder run has
			// to stay in step across them.
			name: "two filters, each with its own join",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q1", Match: MatchContains, Values: []string{"a"}},
					{QuestionID: "q2", Match: MatchAnyOption, Values: []string{"b"}},
				},
			},
			wantSQL: []string{
				`written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id = $1`,
				`written_answers wa1 ON wa1.application_id = a.id AND wa1.question_id = $2`,
				`AND (wa0.answer_text ILIKE $3 ESCAPE '\')`,
				`AND (wa1.answer_options @> jsonb_build_array($4::text))`,
			},
			wantArgs: []any{"q1", "q2", "%a%", "b"},
		},
		{
			// LIKE metacharacters in user input are literals, not wildcards.
			name: "wildcards in the search term are escaped",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q1", Match: MatchContains, Values: []string{"100%_x"}},
				},
			},
			wantArgs: []any{"q1", `%100\%\_x%`},
		},
		{
			// A filter with nothing to match on can't narrow anything, so it
			// shouldn't emit a join or an empty `AND ()`.
			name: "valueless filters are dropped entirely",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionID: "q1", Match: MatchContains, Values: nil},
				},
			},
			wantArgs:  []any{},
			wantNoSQL: []string{`written_answers`},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query, args := listApplicationsQuery(tc.filter)
			for _, want := range tc.wantSQL {
				if !strings.Contains(query, want) {
					t.Errorf("query missing %q\ngot: %s", want, query)
				}
			}
			for _, unwanted := range tc.wantNoSQL {
				if strings.Contains(query, unwanted) {
					t.Errorf("query unexpectedly contains %q\ngot: %s", unwanted, query)
				}
			}
			if !reflect.DeepEqual(args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", args, tc.wantArgs)
			}
			if n := strings.Count(query, "$"); n != len(args) {
				t.Errorf("query has %d placeholders but %d args\ngot: %s", n, len(args), query)
			}
		})
	}
}

func TestListApplicationsQueryHidesDrafts(t *testing.T) {
	query, _ := listApplicationsQuery(ApplicationFilter{})
	if !strings.Contains(query, `a.stage != 'draft'`) {
		t.Fatalf("drafts not excluded by default: %s", query)
	}
	query, _ = listApplicationsQuery(ApplicationFilter{IncludeDraft: true})
	if strings.Contains(query, `a.stage != 'draft'`) {
		t.Fatalf("IncludeDraft should not exclude drafts: %s", query)
	}
}

func TestListApplicationsQueryStages(t *testing.T) {
	query, args := listApplicationsQuery(ApplicationFilter{
		Stages: []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview},
	})
	if !strings.Contains(query, `a.stage = ANY($1::application_stage[])`) {
		t.Fatalf("Stages filter missing: %s", query)
	}
	want := []any{[]string{"submitted", "lead_review"}}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

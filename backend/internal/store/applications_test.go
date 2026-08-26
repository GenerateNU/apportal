package store

import (
	"reflect"
	"regexp"
	"strconv"
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
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"boston"}},
				},
			},
			wantSQL: []string{
				`LEFT JOIN written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id = ANY($1::uuid[])`,
				`AND a.cycle_id = $2`,
				`AND (wa0.answer_text ILIKE $3 ESCAPE '\')`,
			},
			wantArgs: []any{[]string{"q1"}, "c1", "%boston%"},
		},
		{
			name: "checkbox matches the answer_options array",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q2"}, Match: MatchAnyOption, Values: []string{"Yes", "Maybe"}},
				},
			},
			wantSQL: []string{
				`AND (wa0.answer_options @> jsonb_build_array($2::text) OR wa0.answer_options @> jsonb_build_array($3::text))`,
			},
			wantArgs: []any{[]string{"q2"}, "Yes", "Maybe"},
		},
		{
			name: "single-choice matches answer_text exactly",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q3"}, Match: MatchAnyOf, Values: []string{"Fall"}},
				},
			},
			wantSQL:  []string{`AND wa0.answer_text = ANY($2::text[])`},
			wantArgs: []any{[]string{"q3"}, []string{"Fall"}},
		},
		{
			// Two filters get their own join each, and the placeholder run has
			// to stay in step across them.
			name: "two filters, each with its own join",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"a"}},
					{QuestionIDs: []string{"q2"}, Match: MatchAnyOption, Values: []string{"b"}},
				},
			},
			wantSQL: []string{
				`written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id = ANY($1::uuid[])`,
				`written_answers wa1 ON wa1.application_id = a.id AND wa1.question_id = ANY($2::uuid[])`,
				`AND (wa0.answer_text ILIKE $3 ESCAPE '\')`,
				`AND (wa1.answer_options @> jsonb_build_array($4::text))`,
			},
			wantArgs: []any{[]string{"q1"}, []string{"q2"}, "%a%", "b"},
		},
		{
			// LIKE metacharacters in user input are literals, not wildcards.
			name: "wildcards in the search term are escaped",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"100%_x"}},
				},
			},
			wantArgs: []any{[]string{"q1"}, `%100\%\_x%`},
		},
		{
			// The same question authored once per applicant role: one filter,
			// one join, matching an answer to either copy.
			name: "a filter spanning several question ids joins on any of them",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1", "q2"}, Match: MatchAnyOf, Values: []string{"Fall"}},
				},
			},
			wantSQL: []string{
				`LEFT JOIN written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id = ANY($1::uuid[])`,
				`AND wa0.answer_text = ANY($2::text[])`,
			},
			wantArgs:  []any{[]string{"q1", "q2"}, []string{"Fall"}},
			wantNoSQL: []string{`wa1`},
		},
		{
			// A filter with nothing to match on can't narrow anything, so it
			// shouldn't emit a join or an empty `AND ()`.
			name: "valueless filters are dropped entirely",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: nil},
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
			assertPlaceholdersMatchArgs(t, query, args)
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

func TestListApplicationsQueryPaging(t *testing.T) {
	limit := 50
	query, args := listApplicationsQuery(ApplicationFilter{
		CycleID: "c1",
		Limit:   &limit,
		Offset:  100,
	})
	// LIMIT/OFFSET come last, so their placeholders follow every filter's.
	if !strings.Contains(query, `ORDER BY a.submitted_at DESC NULLS LAST LIMIT $2 OFFSET $3`) {
		t.Fatalf("paging clause wrong: %s", query)
	}
	if want := []any{"c1", 50, 100}; !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestListApplicationsQueryUnpagedByDefault(t *testing.T) {
	query, _ := listApplicationsQuery(ApplicationFilter{CycleID: "c1"})
	if strings.Contains(query, "LIMIT") || strings.Contains(query, "OFFSET") {
		t.Fatalf("no limit set should not page: %s", query)
	}
}

// The page, the total, and the stage tabs must agree about what matched, which
// only holds if they share a predicate. These assert the shared part is
// identical and that only the intended pieces differ.
func TestCountAndStageCountsShareThePredicate(t *testing.T) {
	limit := 25
	f := ApplicationFilter{
		CycleID: "c1",
		Search:  "ho",
		Stage:   stagePtr(models.StageSubmitted),
		AnswerFilters: []AnswerFilter{
			{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"boston"}},
		},
		Limit:  &limit,
		Offset: 50,
	}

	countQuery, countArgs := countApplicationsQuery(f)
	if !strings.HasPrefix(countQuery, `SELECT COUNT(DISTINCT a.id) FROM applications a`) {
		t.Fatalf("count query shape: %s", countQuery)
	}
	// The total is of every match, so paging must not leak into it.
	if strings.Contains(countQuery, "LIMIT") || strings.Contains(countQuery, "OFFSET") {
		t.Fatalf("count must ignore paging: %s", countQuery)
	}
	if !strings.Contains(countQuery, `a.stage = $`) {
		t.Fatalf("count must honour the stage filter: %s", countQuery)
	}

	stageQuery, stageArgs := stageCountsQuery(f)
	// Dropping the stage predicate is the whole point: with it applied every
	// other tab would read zero.
	if strings.Contains(stageQuery, `a.stage = $`) {
		t.Fatalf("stage counts must ignore the stage filter: %s", stageQuery)
	}
	if !strings.HasSuffix(stageQuery, ` GROUP BY a.stage`) {
		t.Fatalf("stage counts must group by stage: %s", stageQuery)
	}
	// Every other predicate still applies, so the tabs track the live filters.
	for _, want := range []string{`a.cycle_id = $`, `u.full_name ILIKE $`, `wa0.answer_text ILIKE $`} {
		if !strings.Contains(stageQuery, want) {
			t.Errorf("stage counts missing %q\ngot: %s", want, stageQuery)
		}
	}
	// One fewer arg than the count query: the dropped stage predicate.
	if len(stageArgs) != len(countArgs)-1 {
		t.Errorf("stage args = %#v, count args = %#v", stageArgs, countArgs)
	}
	assertPlaceholdersMatchArgs(t, countQuery, countArgs)
	assertPlaceholdersMatchArgs(t, stageQuery, stageArgs)
}

func TestSearchMatchesNameNuidAndEmail(t *testing.T) {
	query, args := listApplicationsQuery(ApplicationFilter{Search: "50%"})
	for _, want := range []string{
		`u.full_name ILIKE $1 ESCAPE '\'`,
		`a.user_nuid ILIKE $1 ESCAPE '\'`,
		`u.email ILIKE $1 ESCAPE '\'`,
	} {
		if !strings.Contains(query, want) {
			t.Errorf("query missing %q\ngot: %s", want, query)
		}
	}
	// One argument reused across all three columns, with LIKE's own
	// metacharacters escaped.
	if want := []any{`%50\%%`}; !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

// The two "assigned to me" filters hang off different tables, so a queue that
// sets both must not collapse them into one.
func TestAssignedToAndInterviewerFilterSeparately(t *testing.T) {
	query, args := listApplicationsQuery(ApplicationFilter{
		AssignedTo:      "l1",
		InterviewerNUID: "l2",
	})
	for _, want := range []string{
		`EXISTS (SELECT 1 FROM lead_assignments la WHERE la.application_id = a.id AND la.lead_nuid = $1)`,
		`EXISTS (SELECT 1 FROM interview_assignments ia WHERE ia.application_id = a.id AND ia.interviewer_nuid = $2)`,
	} {
		if !strings.Contains(query, want) {
			t.Errorf("query missing %q\ngot: %s", want, query)
		}
	}
	if want := []any{"l1", "l2"}; !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
	assertPlaceholdersMatchArgs(t, query, args)
}

func stagePtr(s models.ApplicationStage) *models.ApplicationStage { return &s }

var placeholderPattern = regexp.MustCompile(`\$(\d+)`)

// assertPlaceholdersMatchArgs checks the highest $N in the query equals the
// number of args. Counting occurrences instead would miscount the search
// predicate, which deliberately reuses one placeholder across three columns.
func assertPlaceholdersMatchArgs(t *testing.T, query string, args []any) {
	t.Helper()
	highest := 0
	for _, m := range placeholderPattern.FindAllStringSubmatch(query, -1) {
		n, err := strconv.Atoi(m[1])
		if err != nil {
			t.Fatalf("unparsable placeholder %q", m[0])
		}
		if n > highest {
			highest = n
		}
	}
	if highest != len(args) {
		t.Errorf("highest placeholder is $%d but there are %d args\ngot: %s", highest, len(args), query)
	}
}

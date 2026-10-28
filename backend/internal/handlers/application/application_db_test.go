package application

import (
	"reflect"
	"strings"
	"testing"

	"gorm.io/gorm"

	appdb "github.com/GenerateNU/apportal/backend/internal/db"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// These build the filter queries on a dry-run connection and assert on the
// generated SQL, which is where a filter going missing would otherwise only
// show up at runtime.

func dryRunDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := appdb.OpenDryRun()
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func listSQL(t *testing.T, f ApplicationFilter) (string, []any) {
	t.Helper()
	stmt := listApplicationsQuery(dryRunDB(t), f).Find(&[]models.ApplicationSummary{}).Statement
	return stmt.SQL.String(), stmt.Vars
}

func countSQL(t *testing.T, f ApplicationFilter) (string, []any) {
	t.Helper()
	var n int64
	stmt := applicationsFrom(dryRunDB(t), f, applicationFilterAll).Distinct("a.id").Count(&n).Statement
	return stmt.SQL.String(), stmt.Vars
}

func stageCountsSQL(t *testing.T, f ApplicationFilter) (string, []any) {
	t.Helper()
	var rows []struct{}
	stmt := applicationsFrom(dryRunDB(t), f, applicationFilterExceptStage).
		Select("a.stage, COUNT(DISTINCT a.id) AS n").Group("a.stage").Scan(&rows).Statement
	return stmt.SQL.String(), stmt.Vars
}

func assertContains(t *testing.T, query string, wants ...string) {
	t.Helper()
	for _, want := range wants {
		if !strings.Contains(query, want) {
			t.Errorf("query missing %q\ngot: %s", want, query)
		}
	}
}

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
				`LEFT JOIN written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id IN ($1)`,
				`a.cycle_id = $2`,
				`wa0.answer_text ILIKE $4 ESCAPE '\'`,
			},
			wantArgs: []any{"q1", "c1", models.StageDraft, "%boston%"},
		},
		{
			name: "checkbox matches the answer_options array",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q2"}, Match: MatchAnyOption, Values: []string{"Yes", "Maybe"}},
				},
			},
			wantSQL: []string{
				`(wa0.answer_options @> jsonb_build_array($3::text) OR wa0.answer_options @> jsonb_build_array($4::text))`,
			},
			wantArgs: []any{"q2", models.StageDraft, "Yes", "Maybe"},
		},
		{
			name: "single-choice matches answer_text exactly",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q3"}, Match: MatchAnyOf, Values: []string{"Fall"}},
				},
			},
			wantSQL:  []string{`wa0.answer_text IN ($3)`},
			wantArgs: []any{"q3", models.StageDraft, "Fall"},
		},
		{
			name: "two filters, each with its own join",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"a"}},
					{QuestionIDs: []string{"q2"}, Match: MatchAnyOption, Values: []string{"b"}},
				},
			},
			wantSQL: []string{
				`written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id IN ($1)`,
				`written_answers wa1 ON wa1.application_id = a.id AND wa1.question_id IN ($2)`,
				`wa0.answer_text ILIKE $4 ESCAPE '\'`,
				`wa1.answer_options @> jsonb_build_array($5::text)`,
			},
			wantArgs: []any{"q1", "q2", models.StageDraft, "%a%", "b"},
		},
		{
			// LIKE metacharacters in user input are literals, not wildcards.
			name: "wildcards in the search term are escaped",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"100%_x"}},
				},
			},
			wantArgs: []any{"q1", models.StageDraft, `%100\%\_x%`},
		},
		{
			// The same question authored once per role: one join matching either copy.
			name: "a filter spanning several question ids joins on any of them",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1", "q2"}, Match: MatchAnyOf, Values: []string{"Fall"}},
				},
			},
			wantSQL: []string{
				`LEFT JOIN written_answers wa0 ON wa0.application_id = a.id AND wa0.question_id IN ($1,$2)`,
				`wa0.answer_text IN ($4)`,
			},
			wantArgs:  []any{"q1", "q2", models.StageDraft, "Fall"},
			wantNoSQL: []string{`wa1`},
		},
		{
			// A filter with nothing to match can't narrow anything, so it emits
			// no join and no empty condition.
			name: "valueless filters are dropped entirely",
			filter: ApplicationFilter{
				AnswerFilters: []AnswerFilter{
					{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: nil},
				},
			},
			wantArgs:  []any{models.StageDraft},
			wantNoSQL: []string{`written_answers`},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query, args := listSQL(t, tc.filter)
			assertContains(t, query, tc.wantSQL...)
			for _, unwanted := range tc.wantNoSQL {
				if strings.Contains(query, unwanted) {
					t.Errorf("query unexpectedly contains %q\ngot: %s", unwanted, query)
				}
			}
			if !reflect.DeepEqual(args, tc.wantArgs) {
				t.Errorf("args = %#v, want %#v", args, tc.wantArgs)
			}
		})
	}
}

func TestListApplicationsQueryHidesDrafts(t *testing.T) {
	query, args := listSQL(t, ApplicationFilter{})
	if !strings.Contains(query, `a.stage != $1`) || !reflect.DeepEqual(args, []any{models.StageDraft}) {
		t.Fatalf("drafts not excluded by default: %s %v", query, args)
	}
	query, _ = listSQL(t, ApplicationFilter{IncludeDraft: true})
	if strings.Contains(query, `a.stage !=`) {
		t.Fatalf("IncludeDraft should not exclude drafts: %s", query)
	}
}

func TestListApplicationsQueryStages(t *testing.T) {
	query, args := listSQL(t, ApplicationFilter{
		Stages: []models.ApplicationStage{models.StageSubmitted, models.StageLeadReview},
	})
	assertContains(t, query, `a.stage IN ($1,$2)`)
	want := []any{models.StageSubmitted, models.StageLeadReview, models.StageDraft}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestListApplicationsQueryReturner(t *testing.T) {
	// Nil is "don't filter", unlike false, which is how the UI asks for
	// first-timers only. u.returner is always selected, so check the predicate.
	unfiltered, _ := listSQL(t, ApplicationFilter{})
	if strings.Contains(unfiltered, "u.returner =") {
		t.Fatalf("nil Returner should not filter: %s", unfiltered)
	}

	for _, want := range []bool{true, false} {
		query, args := listSQL(t, ApplicationFilter{CycleID: "c1", Returner: &want})
		assertContains(t, query, `u.returner = $2`)
		if got := []any{"c1", want, models.StageDraft}; !reflect.DeepEqual(args, got) {
			t.Fatalf("args = %#v, want %#v", args, got)
		}
	}
}

func TestListApplicationsQueryPaging(t *testing.T) {
	limit := 50
	query, args := listSQL(t, ApplicationFilter{CycleID: "c1", Limit: &limit, Offset: 100})
	assertContains(t, query, `ORDER BY a.submitted_at DESC NULLS LAST LIMIT $3 OFFSET $4`)
	if want := []any{"c1", models.StageDraft, 50, 100}; !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestListApplicationsQueryUnpagedByDefault(t *testing.T) {
	query, _ := listSQL(t, ApplicationFilter{CycleID: "c1"})
	if strings.Contains(query, "LIMIT") || strings.Contains(query, "OFFSET") {
		t.Fatalf("no limit set should not page: %s", query)
	}
}

// The page, the total, and the stage tabs must agree about what matched, so
// they share a predicate and differ only where intended.
func TestCountAndStageCountsShareThePredicate(t *testing.T) {
	limit := 25
	stage := models.StageSubmitted
	f := ApplicationFilter{
		CycleID: "c1",
		Search:  "ho",
		Stage:   &stage,
		AnswerFilters: []AnswerFilter{
			{QuestionIDs: []string{"q1"}, Match: MatchContains, Values: []string{"boston"}},
		},
		Limit:  &limit,
		Offset: 50,
	}

	countQuery, countArgs := countSQL(t, f)
	if !strings.HasPrefix(countQuery, `SELECT COUNT(DISTINCT("a"."id")) FROM applications a`) {
		t.Fatalf("count query shape: %s", countQuery)
	}
	if strings.Contains(countQuery, "LIMIT") || strings.Contains(countQuery, "OFFSET") {
		t.Fatalf("count must ignore paging: %s", countQuery)
	}
	assertContains(t, countQuery, `a.stage = $`)

	stageQuery, stageArgs := stageCountsSQL(t, f)
	// With the stage predicate applied every other tab would read zero.
	if strings.Contains(stageQuery, `a.stage = $`) {
		t.Fatalf("stage counts must ignore the stage filter: %s", stageQuery)
	}
	if !strings.HasSuffix(stageQuery, `GROUP BY "a"."stage"`) {
		t.Fatalf("stage counts must group by stage: %s", stageQuery)
	}
	assertContains(t, stageQuery, `a.cycle_id = $`, `u.full_name ILIKE $`, `wa0.answer_text ILIKE $`)
	// One fewer arg than the count: the dropped stage predicate.
	if len(stageArgs) != len(countArgs)-1 {
		t.Errorf("stage args = %#v, count args = %#v", stageArgs, countArgs)
	}
}

func TestSearchMatchesNameNuidAndEmail(t *testing.T) {
	query, args := listSQL(t, ApplicationFilter{Search: "50%"})
	assertContains(t, query,
		`u.full_name ILIKE $1 ESCAPE '\'`,
		`a.user_nuid ILIKE $2 ESCAPE '\'`,
		`u.email ILIKE $3 ESCAPE '\'`,
	)
	// LIKE's own metacharacters are escaped.
	want := []any{`%50\%%`, `%50\%%`, `%50\%%`, models.StageDraft}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

// The two "assigned to me" filters hang off different tables, so a queue that
// sets both must not collapse them into one.
func TestAssignedToAndInterviewerFilterSeparately(t *testing.T) {
	query, args := listSQL(t, ApplicationFilter{AssignedTo: "l1", InterviewerNUID: "l2"})
	assertContains(t, query,
		`EXISTS (SELECT 1 FROM lead_assignments la WHERE la.application_id = a.id AND la.lead_nuid = $1)`,
		`EXISTS (SELECT 1 FROM interview_assignments ia WHERE ia.application_id = a.id AND ia.interviewer_nuid = $2)`,
	)
	if want := []any{"l1", "l2", models.StageDraft}; !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

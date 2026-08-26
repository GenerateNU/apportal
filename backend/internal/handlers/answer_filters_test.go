package handlers

import (
	"errors"
	"net/http"
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/store"
)

func TestParseAnswerFilters(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want []store.AnswerFilter
	}{
		{"empty", "", nil},
		{"blank", "   ", nil},
		{"empty array", "[]", []store.AnswerFilter{}},
		{
			// Free text matches as a substring, and a bare string is accepted
			// in place of a one-element array.
			"free text",
			`[{"question_id":"q1","question_type":"short_answer","values":"boston"}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q1"}, Match: store.MatchContains, Values: []string{"boston"}}},
		},
		{
			// Checkbox answers live in answer_options, so they match on the
			// JSONB array rather than the scalar text column.
			"checkbox",
			`[{"question_id":"q2","question_type":"checkbox","values":["Yes","No"]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q2"}, Match: store.MatchAnyOption, Values: []string{"Yes", "No"}}},
		},
		{
			// question_ids carries the same question's per-role copies, and is
			// unioned with question_id rather than replacing it.
			"question_ids",
			`[{"question_ids":["q5","q6"],"question_type":"checkbox","values":["Mon"]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q5", "q6"}, Match: store.MatchAnyOption, Values: []string{"Mon"}}},
		},
		{
			"question_id and question_ids together",
			`[{"question_id":"q5","question_ids":["q6"],"question_type":"checkbox","values":["Mon"]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q5", "q6"}, Match: store.MatchAnyOption, Values: []string{"Mon"}}},
		},
		{
			// Dropdown and multiple_choice both store a single label in
			// answer_text, so they match exactly, not by substring.
			"dropdown",
			`[{"question_id":"q3","question_type":"dropdown","values":["Fall"]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q3"}, Match: store.MatchAnyOf, Values: []string{"Fall"}}},
		},
		{
			"multiple choice",
			`[{"question_id":"q4","question_type":"multiple_choice","values":["A"]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q4"}, Match: store.MatchAnyOf, Values: []string{"A"}}},
		},
		{
			// A half-built filter from the UI is dropped rather than rejected,
			// so it doesn't turn into a match-everything `%%`.
			"blank values dropped",
			`[{"question_id":"q1","question_type":"short_answer","values":"  "},
			  {"question_id":"q2","question_type":"checkbox","values":[]}]`,
			[]store.AnswerFilter{},
		},
		{
			"blank entries within an array dropped",
			`[{"question_id":"q2","question_type":"checkbox","values":["Yes",""]}]`,
			[]store.AnswerFilter{{QuestionIDs: []string{"q2"}, Match: store.MatchAnyOption, Values: []string{"Yes"}}},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseAnswerFilters(tc.raw)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %#v, want %#v", got, tc.want)
			}
		})
	}
}

func TestParseAnswerFiltersRejects(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"not json", `not-json`},
		{"not an array", `{"question_id":"q1"}`},
		{"missing question_id", `[{"question_type":"short_answer","values":"x"}]`},
		{"unknown question type", `[{"question_id":"q1","question_type":"telepathy","values":"x"}]`},
		{"values not a string or array", `[{"question_id":"q1","question_type":"checkbox","values":{"options":["Yes"]}}]`},
		{"too many filters", tooManyFilters()},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := parseAnswerFilters(tc.raw)
			var se huma.StatusError
			if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
				t.Fatalf("got %v, want 422", err)
			}
		})
	}
}

func tooManyFilters() string {
	raw := `[`
	for i := 0; i <= maxAnswerFilters; i++ {
		if i > 0 {
			raw += `,`
		}
		raw += `{"question_id":"q","question_type":"short_answer","values":"x"}`
	}
	return raw + `]`
}

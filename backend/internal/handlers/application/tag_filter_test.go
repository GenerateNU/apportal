package application

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

const (
	tagA = "11111111-1111-1111-1111-111111111111"
	tagB = "22222222-2222-2222-2222-222222222222"
)

func TestParseTagIDs(t *testing.T) {
	got, err := parseTagIDs(" " + tagA + " ," + strings.ToUpper(tagB) + ",")
	if err != nil || !slices.Equal(got, []string{tagA, tagB}) {
		t.Fatalf("got %v, %v", got, err)
	}
	if got, err := parseTagIDs(""); err != nil || len(got) != 0 {
		t.Fatalf("empty: got %v, %v", got, err)
	}
}

func TestParseTagIDsRejectsMalformed(t *testing.T) {
	_, err := parseTagIDs(tagA + ",not-a-uuid")
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	_, err = parseTagIDs(strings.Repeat(tagA+",", utils.MaxBulkApplications+1))
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

// Any-of: the filter must be array overlap, and it must be in the shared
// WHERE so the list, total and stage counts agree.
func TestTagFilterMatchesAnyTag(t *testing.T) {
	f := ApplicationFilter{TagIDs: []string{tagA, tagB}}

	query, vars := listSQL(t, f)
	assertContains(t, query, "a.tag_ids && ")
	if !slices.Contains(vars, any("{"+tagA+","+tagB+"}")) {
		t.Errorf("vars missing the tag literal: %v", vars)
	}
	count, _ := countSQL(t, f)
	assertContains(t, count, "a.tag_ids && ")
	stages, _ := stageCountsSQL(t, f)
	assertContains(t, stages, "a.tag_ids && ")
}

func TestNoTagFilterOmitsClause(t *testing.T) {
	query, _ := listSQL(t, ApplicationFilter{})
	if strings.Contains(query, "a.tag_ids &&") {
		t.Errorf("unexpected tag clause: %s", query)
	}
}

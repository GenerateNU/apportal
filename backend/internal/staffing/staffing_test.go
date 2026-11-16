package staffing

import (
	"errors"
	"net/http"
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestEligibleDefaults(t *testing.T) {
	o := Openings{
		Staff:   []string{"ann", "bob", "cat", "dan"},
		Members: map[string][]string{"g1": {"ann", "bob", "zed"}, "g2": {"cat"}},
		Teams: map[string]Teams{
			"eng": {models.KindInterviewer: {"g1"}},
			"des": {models.KindReviewer: {"g2"}, models.KindInterviewer: {"g2"}, models.KindRecordingReviewer: {"g1"}},
		},
	}
	cases := []struct {
		role string
		kind models.StaffKind
		want []string
	}{
		{"eng", models.KindReviewer, []string{"ann", "bob", "cat", "dan"}},
		{"eng", models.KindInterviewer, []string{"ann", "bob"}},
		{"eng", models.KindRecordingReviewer, []string{"ann", "bob"}},
		{"des", models.KindReviewer, []string{"cat"}},
		{"des", models.KindRecordingReviewer, []string{"ann", "bob"}},
		{"none", models.KindRecordingReviewer, []string{"ann", "bob", "cat", "dan"}},
	}
	for _, c := range cases {
		if got := o.Eligible(c.role, c.kind); !slices.Equal(got, c.want) {
			t.Errorf("%s %s = %v, want %v", c.role, c.kind, got, c.want)
		}
	}
}

func TestPerApplicantDefaults(t *testing.T) {
	cases := []struct {
		kind models.StaffKind
		s    stageSetting
		want int
	}{
		{models.KindInterviewer, stageSetting{}, DefaultInterviewers},
		{models.KindInterviewer, stageSetting{Found: true, Active: true, Required: 3}, 3},
		{models.KindRecordingReviewer, stageSetting{}, 0},
		{models.KindRecordingReviewer, stageSetting{Found: true, Active: false, Required: 2}, 0},
		{models.KindRecordingReviewer, stageSetting{Found: true, Active: true}, DefaultRecordingReviewers},
		{models.KindRecordingReviewer, stageSetting{Found: true, Active: true, Required: 2}, 2},
		{models.KindReviewer, stageSetting{Found: true, Active: true}, DefaultReviewers},
	}
	for _, c := range cases {
		if got := perApplicant(c.kind, c.s); got != c.want {
			t.Errorf("%s %+v = %d, want %d", c.kind, c.s, got, c.want)
		}
	}
}

func TestCheck(t *testing.T) {
	app := Applicant{
		Assigned: map[models.StaffKind][]string{
			models.KindInterviewer:       {"ann"},
			models.KindRecordingReviewer: {"rob"},
		},
		Conflicted: map[string]bool{"cat": true},
	}
	open := Rules{Limit: 2, Eligible: []string{"ann", "bob", "cat", "rob", "dan"}}
	cases := []struct {
		name  string
		rules Rules
		nuid  string
		kind  models.StaffKind
		want  error
	}{
		{"ok", open, "bob", models.KindInterviewer, nil},
		{"locked", Rules{Released: true, Limit: 2, Eligible: open.Eligible}, "bob", models.KindInterviewer, ErrLocked},
		{"off", Rules{Eligible: open.Eligible}, "bob", models.KindRecordingReviewer, ErrOff},
		{"already", open, "ann", models.KindInterviewer, ErrAlready},
		{"not eligible", open, "eve", models.KindInterviewer, ErrNotEligible},
		{"conflict", open, "cat", models.KindInterviewer, ErrConflicted},
		{"recording reviewer can't interview", open, "rob", models.KindInterviewer, ErrSamePerson},
		{"interviewer can't review recording", open, "ann", models.KindRecordingReviewer, ErrSamePerson},
		{"full", Rules{Limit: 1, Eligible: open.Eligible}, "bob", models.KindInterviewer, ErrFull},
	}
	for _, c := range cases {
		if got := Check(app, c.rules, c.nuid, c.kind); !errors.Is(got, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestHTTPError(t *testing.T) {
	testutil.WantStatus(t, HTTPError(ErrNotEligible), http.StatusUnprocessableEntity)
	testutil.WantStatus(t, HTTPError(ErrFull), http.StatusConflict)
	testutil.WantStatus(t, HTTPError(ErrSamePerson), http.StatusConflict)
}

func TestSnapshotCheckUsesOpeningRules(t *testing.T) {
	snap := Snapshot{
		Openings:   Openings{Staff: []string{"ann", "bob"}, Teams: map[string]Teams{"eng": {models.KindInterviewer: {"g"}}}, Members: map[string][]string{"g": {"bob"}}},
		Limits:     map[models.StaffKind]int{models.KindInterviewer: 2},
		Released:   map[string]bool{},
		Applicants: map[string]*Applicant{"a1": {ApplicationID: "a1", RoleID: "eng", Assigned: map[models.StaffKind][]string{}}},
	}
	if err := snap.Check("a1", "ann", models.KindInterviewer); !errors.Is(err, ErrNotEligible) {
		t.Errorf("ann isn't in the interview group: %v", err)
	}
	if err := snap.Check("a1", "bob", models.KindInterviewer); err != nil {
		t.Errorf("bob: %v", err)
	}
	snap.Released["eng"] = true
	if err := snap.Check("a1", "bob", models.KindInterviewer); !errors.Is(err, ErrLocked) {
		t.Errorf("released opening: %v", err)
	}
}

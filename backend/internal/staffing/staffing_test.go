package staffing

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
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
		kind models.StepKind
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

func TestPolicyFromWorkflow(t *testing.T) {
	f := workflow.NewCycleState("c")
	f.Openings = []workflow.Opening{{RoleID: "eng"}, {RoleID: "des"}}
	f.SetAssignment(models.StepInterviews, models.KindInterviewer, 3)
	f.SetRelease("eng", models.StepInterviews, time.Now())
	f.SetRelease("des", models.StepDecisions, time.Now())

	p := PolicyFrom(f, workflow.Caller{Tier: workflow.TierChief})
	if p.Limits[models.KindInterviewer] != 3 || p.Limits[models.KindRecordingReviewer] != 0 || p.Limits[models.KindReviewer] != 0 {
		t.Errorf("limits = %v", p.Limits)
	}
	testutil.WantStatus(t, p.Adds.Of(models.KindInterviewer, "eng"), http.StatusConflict)
	testutil.WantStatus(t, p.Removes.Of(models.KindInterviewer, "eng"), http.StatusConflict)
	testutil.WantStatus(t, p.Adds.Of(models.KindInterviewer, "des"), http.StatusConflict)
	admin := PolicyFrom(f, workflow.Caller{Tier: workflow.TierAdmin, Intent: middleware.Intent{Confirm: true}})
	for role, err := range map[string]error{"eng add": admin.Adds.Of(models.KindInterviewer, "eng"), "eng remove": admin.Removes.Of(models.KindInterviewer, "eng"), "des add": admin.Adds.Of(models.KindInterviewer, "des")} {
		if err != nil {
			t.Errorf("a confirmed admin overrides %s: %v", role, err)
		}
	}

	f.Enabled[models.StepInterviews] = false
	if n := PolicyFrom(f, workflow.Caller{Tier: workflow.TierChief}).Limits[models.KindInterviewer]; n != 0 {
		t.Errorf("interviews off: limit %d", n)
	}
}

func TestUnsetCounts(t *testing.T) {
	app := Applicant{Assigned: map[models.StepKind][]string{}}
	r := Rules{Eligible: []string{"ann"}}
	err := Check(app, r, "ann", models.KindInterviewer)
	if !errors.Is(err, ErrUnset) {
		t.Fatalf("interviewer with no count: %v", err)
	}
	testutil.WantStatus(t, HTTPError(err), http.StatusConflict)
	if err := Check(app, r, "ann", models.KindRecordingReviewer); !errors.Is(err, ErrOff) {
		t.Errorf("recording reviews with no count are off: %v", err)
	}
}

func TestBlocked(t *testing.T) {
	frozen := huma.Error409Conflict("frozen")
	snap := Snapshot{Adds: Permissions{models.KindInterviewer: {"des": frozen}}, Removes: Permissions{models.KindInterviewer: {"eng": frozen}}}
	if err := snap.AddBlocked("des", models.KindInterviewer); !errors.Is(err, frozen) {
		t.Errorf("add: %v", err)
	}
	if err := snap.RemoveBlocked("eng", models.KindInterviewer); !errors.Is(err, frozen) {
		t.Errorf("remove: %v", err)
	}
	if err := snap.AddBlocked("ops", models.KindInterviewer); err != nil {
		t.Errorf("open opening: %v", err)
	}
}

func TestEligibleRejectsNonStaffKind(t *testing.T) {
	if _, err := Eligible(context.Background(), nil, "c", "r", models.KindApplicant); !errors.Is(err, ErrNotStaffKind) {
		t.Errorf("applicant kind: %v", err)
	}
}

func TestCheck(t *testing.T) {
	app := Applicant{
		Assigned: map[models.StepKind][]string{
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
		kind  models.StepKind
		want  error
	}{
		{"ok", open, "bob", models.KindInterviewer, nil},
		{"off", Rules{Eligible: open.Eligible}, "bob", models.KindRecordingReviewer, ErrOff},
		{"blocked", Rules{Blocked: ErrFull, Limit: 2, Eligible: open.Eligible}, "bob", models.KindInterviewer, ErrFull},
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
		Limits:     map[models.StepKind]int{models.KindInterviewer: 2},
		Adds:       Permissions{models.KindInterviewer: {}},
		Applicants: map[string]*Applicant{"a1": {ApplicationID: "a1", RoleID: "eng", Assigned: map[models.StepKind][]string{}}},
	}
	if err := snap.Check("a1", "ann", models.KindInterviewer); !errors.Is(err, ErrNotEligible) {
		t.Errorf("ann isn't in the interview group: %v", err)
	}
	if err := snap.Check("a1", "bob", models.KindInterviewer); err != nil {
		t.Errorf("bob: %v", err)
	}
	released := errors.New("interviews are released")
	snap.Adds[models.KindInterviewer]["eng"] = released
	if err := snap.Check("a1", "bob", models.KindInterviewer); !errors.Is(err, released) {
		t.Errorf("released opening: %v", err)
	}
}

func TestReviewersOnlyWhileInReview(t *testing.T) {
	r := Rules{Limit: 2, Eligible: []string{"ann"}}
	for stage, ok := range map[models.ApplicationStage]bool{
		models.StageSubmitted: true, models.StageLeadReview: true, models.StageChiefReview: true,
		models.StageInterview: false, models.StageRejected: false, models.StageSelection: false,
	} {
		app := Applicant{Stage: stage, Assigned: map[models.StepKind][]string{}}
		err := Check(app, r, "ann", models.KindReviewer)
		if ok != (err == nil) || (!ok && !errors.Is(err, ErrNotInReview)) {
			t.Errorf("%s: %v", stage, err)
		}
	}
	if err := Check(Applicant{Stage: models.StageInterview, Assigned: map[models.StepKind][]string{}}, r, "ann", models.KindInterviewer); err != nil {
		t.Errorf("the stage rule is only for reviewers: %v", err)
	}
}

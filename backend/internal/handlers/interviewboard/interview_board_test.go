package interviewboard

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/access/accesstest"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestPermissions(t *testing.T) {
	cases := map[string]func(context.Context, *interviewBoardService) error{
		"board": func(ctx context.Context, s *interviewBoardService) error {
			_, err := s.board(ctx, &BoardInput{ID: accesstest.CycleID})
			return err
		},
		"assignable staff": func(ctx context.Context, s *interviewBoardService) error {
			_, err := s.assignable(ctx, &AssignableInput{ID: accesstest.CycleID, Kind: models.KindReviewer, ApplicationIDs: accesstest.ApplicationID})
			return err
		},
		"auto plan dry run": func(ctx context.Context, s *interviewBoardService) error {
			in := &AutoPlanInput{ID: accesstest.CycleID}
			in.Body.DryRun = true
			_, err := s.autoPlan(ctx, in)
			return err
		},
		"auto plan save": func(ctx context.Context, s *interviewBoardService) error {
			in := &AutoPlanInput{ID: accesstest.CycleID}
			in.Body.RoleIDs = []string{accesstest.RoleID}
			_, err := s.autoPlan(ctx, in)
			return err
		},
	}
	for name, call := range cases {
		t.Run(name, func(t *testing.T) {
			accesstest.Run(t, accesstest.Managers, func(ctx context.Context, gate access.Gate) error {
				return call(ctx, newService(gate, accesstest.DB(t)))
			})
		})
	}
}

func TestMalformedInput(t *testing.T) {
	ctx := testutil.WithActor(*accesstest.Admin.Actor)
	s := newService(&accesstest.Recorder{Static: accesstest.Fixture()}, accesstest.DB(t))

	_, err := s.board(ctx, &BoardInput{ID: accesstest.CycleID, RoleID: "eng"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	in := &AutoPlanInput{ID: accesstest.CycleID}
	in.Body.RoleIDs = []string{"eng"}
	_, err = s.autoPlan(ctx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	in.Body.RoleIDs = []string{accesstest.RoleID}
	_, err = s.autoPlan(ctx, &AutoPlanInput{ID: "c"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func applicant(id, role string, stage models.ApplicationStage, assigned map[models.StepKind][]string) *staffing.Applicant {
	if assigned == nil {
		assigned = map[models.StepKind][]string{}
	}
	return &staffing.Applicant{ApplicationID: id, RoleID: role, Stage: stage, Assigned: assigned, Conflicted: map[string]bool{}}
}

func snapshot(apps ...*staffing.Applicant) staffing.Snapshot {
	s := staffing.Snapshot{
		Openings: staffing.Openings{Staff: []string{"ann", "bob", "cat", "dan", "eve"}, Teams: map[string]staffing.Teams{}, Members: map[string][]string{}},
		Limits:   map[models.StepKind]int{models.KindInterviewer: 2, models.KindRecordingReviewer: 1},
		Released: map[string]bool{}, Applicants: map[string]*staffing.Applicant{},
	}
	for _, a := range apps {
		s.Applicants[a.ApplicationID] = a
	}
	return s
}

func who(plan []PlannedAssignment, app string) []string {
	var out []string
	for _, p := range plan {
		if p.ApplicationID == app {
			out = append(out, p.NUID)
		}
	}
	slices.Sort(out)
	return out
}

func TestPlanFillsToCapWithTeamAndConflicts(t *testing.T) {
	x := applicant("x", "eng", models.StageInterview, map[models.StepKind][]string{models.KindInterviewer: {"ann"}})
	y := applicant("y", "eng", models.StageInterview, nil)
	y.Conflicted["bob"] = true
	done := applicant("z", "eng", models.StageInterviewConducted, nil)
	snap := snapshot(x, y, done)
	snap.Openings.Teams["eng"] = staffing.Teams{models.KindInterviewer: {"g"}}
	snap.Openings.Members["g"] = []string{"ann", "bob", "cat"}

	plan := buildPlan(snap, facts{roles: []string{"eng"}}, options{})
	if got := who(plan.Interviewers, "x"); len(got) != 1 || got[0] == "ann" {
		t.Errorf("x needs one more, not ann again: %v", got)
	}
	if got := who(plan.Interviewers, "y"); !slices.Equal(got, []string{"ann", "cat"}) {
		t.Errorf("y can't have bob, and only the team interviews: %v", got)
	}
	if len(who(plan.Interviewers, "z")) != 0 {
		t.Error("conducted interviews aren't replanned")
	}
	if len(plan.ShortInterviewers) != 0 {
		t.Errorf("short %v", plan.ShortInterviewers)
	}
}

func TestPlanRecordingNeverInterviewer(t *testing.T) {
	x := applicant("x", "eng", models.StageInterview, map[models.StepKind][]string{models.KindInterviewer: {"ann"}})
	y := applicant("y", "eng", models.StageInterviewReview, map[models.StepKind][]string{models.KindInterviewer: {"dan", "eve"}})
	snap := snapshot(x, y)
	plan := buildPlan(snap, facts{roles: []string{"eng"}}, options{withRecording: true})
	ivX := append(who(plan.Interviewers, "x"), "ann")
	for _, r := range who(plan.RecordingReviewers, "x") {
		if slices.Contains(ivX, r) {
			t.Errorf("x's recording reviewer %s also interviews them (%v)", r, ivX)
		}
	}
	if got := who(plan.RecordingReviewers, "y"); len(got) != 1 || got[0] == "dan" || got[0] == "eve" {
		t.Errorf("y: %v", got)
	}
	for _, kind := range []models.StepKind{models.KindInterviewer, models.KindRecordingReviewer} {
		for _, p := range append(plan.Interviewers, plan.RecordingReviewers...) {
			if p.Kind == kind && snap.Applicants[p.ApplicationID].Has(otherKind(kind), p.NUID) {
				t.Errorf("%s is both kinds on %s", p.NUID, p.ApplicationID)
			}
		}
	}
}

func otherKind(k models.StepKind) models.StepKind {
	if k == models.KindInterviewer {
		return models.KindRecordingReviewer
	}
	return models.KindInterviewer
}

func TestPlanRecordingOffAndReleased(t *testing.T) {
	snap := snapshot(applicant("x", "eng", models.StageInterview, nil), applicant("y", "des", models.StageInterview, nil))
	snap.Limits[models.KindRecordingReviewer] = 0
	snap.Released["des"] = true
	plan := buildPlan(snap, facts{roles: []string{"eng", "des"}}, options{withRecording: true})
	if len(plan.RecordingReviewers) != 0 || len(who(plan.Interviewers, "y")) != 0 {
		t.Errorf("%+v", plan)
	}
	if len(plan.Warnings) != 2 {
		t.Errorf("want released and recording-off warnings: %v", plan.Warnings)
	}
}

func TestPlanBalancesAcrossOpenings(t *testing.T) {
	var apps []*staffing.Applicant
	for _, id := range []string{"e1", "e2", "e3", "e4"} {
		apps = append(apps, applicant(id, "eng", models.StageInterview, nil))
	}
	for _, id := range []string{"d1", "d2"} {
		apps = append(apps, applicant(id, "des", models.StageInterview, nil))
	}
	snap := snapshot(apps...)
	snap.Openings.Staff = []string{"ann", "bob", "cat", "dan"}
	plan := buildPlan(snap, facts{roles: []string{"eng", "des"}}, options{})
	if len(plan.Interviewers) != 12 {
		t.Fatalf("got %d", len(plan.Interviewers))
	}
	for _, l := range plan.Loads {
		if l.Added != 3 {
			t.Errorf("%s added %d, want 3", l.NUID, l.Added)
		}
	}
}

func TestPlanByPanel(t *testing.T) {
	x := applicant("x", "eng", models.StageInterview, nil)
	y := applicant("y", "eng", models.StageInterview, map[models.StepKind][]string{models.KindInterviewer: {"eve"}})
	snap := snapshot(x, y)
	snap.Openings.Teams["eng"] = staffing.Teams{models.KindInterviewer: {"g"}}
	snap.Openings.Members["g"] = []string{"ann", "bob", "cat", "dan"}
	panel := func(id string, members ...string) models.InterviewPanelDetail {
		p := models.InterviewPanelDetail{InterviewPanel: models.InterviewPanel{ID: id}}
		for _, m := range members {
			p.Members = append(p.Members, models.PanelMember{UserNUID: m})
		}
		return p
	}
	f := facts{roles: []string{"eng"}, panels: []models.InterviewPanelDetail{
		panel("p-big", "ann", "bob", "cat"),
		panel("p-off", "dan", "eve"),
		panel("p-ok", "bob", "dan"),
	}}
	plan := buildPlan(snap, f, options{byPanel: true})
	if got := who(plan.Interviewers, "x"); !slices.Equal(got, []string{"bob", "dan"}) {
		t.Errorf("only p-ok is eligible and within the cap: %v", got)
	}
	if len(who(plan.Interviewers, "y")) != 0 {
		t.Error("an applicant with an interviewer doesn't get a panel")
	}
	for _, p := range plan.Interviewers {
		if p.PanelID != "p-ok" {
			t.Errorf("panel id %q", p.PanelID)
		}
	}
}

func TestPlanSlotMatching(t *testing.T) {
	x := applicant("x", "eng", models.StageInterview, nil)
	y := applicant("y", "eng", models.StageInterview, nil)
	z := applicant("z", "eng", models.StageInterview, nil)
	snap := snapshot(x, y, z)
	snap.Limits[models.KindInterviewer] = 1
	f := facts{
		roles:     []string{"eng"},
		staffSlot: map[string]string{"ann": "tue", "bob": "wed"},
		appSlots:  map[string][]string{"x": {"wed"}, "y": {"fri"}},
	}
	plan := buildPlan(snap, f, options{matchSlots: true})
	if got := who(plan.Interviewers, "x"); !slices.Equal(got, []string{"bob"}) {
		t.Errorf("x: %v", got)
	}
	if len(who(plan.Interviewers, "y")) != 1 || len(who(plan.Interviewers, "z")) != 1 {
		t.Errorf("y and z are still assigned: %v", plan.Interviewers)
	}
	if !slices.Equal(plan.NoSlotMatch, []string{"y"}) {
		t.Errorf("no_slot_match %v", plan.NoSlotMatch)
	}
}

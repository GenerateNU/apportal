package assignmentplanner

import (
	"slices"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/interviewassign"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

func group(id string, members ...string) models.InterviewGroupDetail {
	g := models.InterviewGroupDetail{InterviewGroup: models.InterviewGroup{ID: id, Name: id}}
	for _, m := range members {
		g.Members = append(g.Members, models.InterviewGroupMemberDetail{GroupID: id, MemberNUID: m})
	}
	return g
}

func TestGroupPlanAssignsEveryMember(t *testing.T) {
	groups := map[string]models.InterviewGroupDetail{
		"g1": group("g1", "alice", "bob"),
		"g2": group("g2", "carol", "dan"),
	}
	days := []PlanGroupDay{{GroupID: "g1", Day: "mon"}, {GroupID: "g2", Day: "tue"}}
	units := groupUnits(days, groups)
	in := toUnitInput(interviewassign.InterviewerInput{
		Applicants: []interviewassign.Applicant{
			{ApplicationID: "a1", AvailableDays: map[string]bool{"mon": true}},
			{ApplicationID: "a2", AvailableDays: map[string]bool{"tue": true}},
			{ApplicationID: "a3", AvailableDays: map[string]bool{"tue": true}},
		},
		Existing:  map[string][]string{"a3": {"zed"}},
		Conflicts: map[string]map[string]bool{"a2": {"alice": true}},
		Cap:       5,
	}, units)

	if _, skipped := in.Existing["a3"]; !skipped {
		t.Fatal("an application with an interviewer outside every group should still be skipped")
	}
	if !in.Conflicts["a2"]["g1"] {
		t.Fatal("a member's conflict should exclude their whole group")
	}

	plan, err := interviewassign.PlanInterviewers(in)
	if err != nil {
		t.Fatal(err)
	}
	run := interviewerRun{plan: plan, units: unitsByID(units)}
	var got []string
	for _, p := range run.newPairs() {
		got = append(got, p.ApplicationID+":"+p.LeadNUID)
	}
	slices.Sort(got)
	want := []string{"a1:alice", "a1:bob", "a2:carol", "a2:dan"}
	if !slices.Equal(got, want) {
		t.Fatalf("pairs = %v, want %v", got, want)
	}
}

func TestGroupPlanCountsExistingAgainstGroup(t *testing.T) {
	groups := map[string]models.InterviewGroupDetail{"g1": group("g1", "alice", "bob")}
	in := toUnitInput(interviewassign.InterviewerInput{
		Existing: map[string][]string{"a1": {"alice", "bob"}},
	}, groupUnits([]PlanGroupDay{{GroupID: "g1", Day: "mon"}}, groups))

	if !slices.Equal(in.Existing["a1"], []string{"g1"}) {
		t.Fatalf("existing = %v, want the group counted once", in.Existing["a1"])
	}
}

func TestGroupPlanWarnsAboutInterviewersOutsideEveryGroup(t *testing.T) {
	groups := map[string]models.InterviewGroupDetail{"g1": group("g1", "alice")}
	in := toUnitInput(interviewassign.InterviewerInput{
		Applicants: []interviewassign.Applicant{{ApplicationID: "a1"}, {ApplicationID: "a2"}},
		Existing:   map[string][]string{"a1": {"zed"}},
		Cap:        5,
	}, groupUnits([]PlanGroupDay{{GroupID: "g1"}}, groups))

	plan, err := interviewassign.PlanInterviewers(in)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Warnings) == 0 {
		t.Fatal("want a warning about zed, who is in no selected group")
	}
	if len(plan.New) != 1 || plan.New[0].ApplicationID != "a2" {
		t.Fatalf("New = %+v, want only a2 planned", plan.New)
	}
}

func TestLeadPlanPairsEachLeadWithThemself(t *testing.T) {
	units := leadUnits([]PlanLeadDay{{LeadNUID: "alice"}})
	in := toUnitInput(interviewassign.InterviewerInput{
		Applicants: []interviewassign.Applicant{{ApplicationID: "a1"}},
		Cap:        5,
	}, units)
	plan, err := interviewassign.PlanInterviewers(in)
	if err != nil {
		t.Fatal(err)
	}
	pairs := interviewerRun{plan: plan, units: unitsByID(units)}.newPairs()
	if len(pairs) != 1 || pairs[0].LeadNUID != "alice" || pairs[0].ApplicationID != "a1" {
		t.Fatalf("pairs = %+v, want a1:alice", pairs)
	}
}

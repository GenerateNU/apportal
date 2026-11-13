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
	in := asGroupInput(interviewassign.InterviewerInput{
		Applicants: []interviewassign.Applicant{
			{ApplicationID: "a1", AvailableDays: map[string]bool{"mon": true}},
			{ApplicationID: "a2", AvailableDays: map[string]bool{"tue": true}},
			{ApplicationID: "a3", AvailableDays: map[string]bool{"tue": true}},
		},
		Existing:  map[string][]string{"a3": {"zed"}},
		Conflicts: map[string]map[string]bool{"a2": {"alice": true}},
		Cap:       5,
	}, days, groups)

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
	run := interviewerRun{plan: plan, groups: groups}
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
	in := asGroupInput(interviewassign.InterviewerInput{
		Existing: map[string][]string{"a1": {"alice", "bob"}},
	}, []PlanGroupDay{{GroupID: "g1", Day: "mon"}}, groups)

	if !slices.Equal(in.Existing["a1"], []string{"g1"}) {
		t.Fatalf("existing = %v, want the group counted once", in.Existing["a1"])
	}
}

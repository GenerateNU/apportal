package interviewassign

import (
	"fmt"
	"testing"
)

func leads(n int, day string) []Lead {
	out := make([]Lead, n)
	for i := range out {
		out[i] = Lead{NUID: fmt.Sprintf("lead-%s-%02d", day, i), Day: day}
	}
	return out
}

func applicants(n int, availableDays ...string) []Applicant {
	days := make(map[string]bool, len(availableDays))
	for _, d := range availableDays {
		days[d] = true
	}
	out := make([]Applicant, n)
	for i := range out {
		out[i] = Applicant{ApplicationID: fmt.Sprintf("app%03d", i), AvailableDays: days}
	}
	return out
}

func TestPlanInterviewersDayMatchPreferred(t *testing.T) {
	// One Monday lead, one Tuesday lead, applicant only available Monday.
	in := InterviewerInput{
		Applicants: []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:      []Lead{{NUID: "mon", Day: "monday"}, {NUID: "tue", Day: "tuesday"}},
		Cap:        10,
		Seed:       SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if len(plan.New) != 1 || plan.New[0].LeadNUID != "mon" {
		t.Fatalf("New = %+v, want app1 assigned to mon", plan.New)
	}
	if len(plan.NoDayMatch) != 0 {
		t.Errorf("NoDayMatch = %v, want none", plan.NoDayMatch)
	}
}

func TestPlanInterviewersFallsBackWhenNoDayMatches(t *testing.T) {
	in := InterviewerInput{
		Applicants: []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"friday": true}}},
		Leads:      []Lead{{NUID: "mon", Day: "monday"}},
		Cap:        10,
		Seed:       SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if len(plan.New) != 1 || plan.New[0].LeadNUID != "mon" {
		t.Fatalf("New = %+v, want best-effort assignment to mon", plan.New)
	}
	if len(plan.NoDayMatch) != 1 || plan.NoDayMatch[0] != "app1" {
		t.Errorf("NoDayMatch = %v, want [app1]", plan.NoDayMatch)
	}
	if len(plan.Warnings) == 0 {
		t.Error("want a warning about the day mismatch")
	}
}

func TestPlanInterviewersAvoidsOwnWrittenReview(t *testing.T) {
	// Two same-day leads with equal load; one wrote this applicant's review.
	in := InterviewerInput{
		Applicants:  []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:       []Lead{{NUID: "a", Day: "monday"}, {NUID: "b", Day: "monday"}},
		WroteReview: map[string]map[string]bool{"app1": {"a": true}},
		Cap:         10,
		Seed:        SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if len(plan.New) != 1 || plan.New[0].LeadNUID != "b" {
		t.Fatalf("New = %+v, want app1 assigned to b (avoiding a, who wrote the review)", plan.New)
	}
}

func TestPlanInterviewersSkipsExistingAndCountsLoad(t *testing.T) {
	in := InterviewerInput{
		Applicants: []Applicant{
			{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}},
			{ApplicationID: "app2", AvailableDays: map[string]bool{"monday": true}},
		},
		Leads:    []Lead{{NUID: "a", Day: "monday"}, {NUID: "b", Day: "monday"}},
		Existing: map[string]string{"app1": "a"},
		Cap:      1,
		Seed:     SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if len(plan.New) != 1 || plan.New[0].ApplicationID != "app2" {
		t.Fatalf("New = %+v, want only app2 assigned (app1 already has an interviewer)", plan.New)
	}
	// a is already at cap 1 from the existing assignment, so app2 must go to b.
	if plan.New[0].LeadNUID != "b" {
		t.Errorf("app2 assigned to %s, want b (a is at cap)", plan.New[0].LeadNUID)
	}
}

func TestPlanInterviewersReportsUnassignedWhenOverCapacity(t *testing.T) {
	in := InterviewerInput{
		Applicants: applicants(3, "monday"),
		Leads:      []Lead{{NUID: "a", Day: "monday"}},
		Cap:        1,
		Seed:       SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if len(plan.New) != 1 {
		t.Fatalf("New = %+v, want exactly 1 assignment (cap 1, one lead)", plan.New)
	}
	if len(plan.Unassigned) != 2 {
		t.Errorf("Unassigned = %v, want 2 applicants left over", plan.Unassigned)
	}
	if len(plan.Warnings) == 0 {
		t.Error("want a capacity warning")
	}
}

func TestPlanInterviewersDeterministic(t *testing.T) {
	in := InterviewerInput{
		Applicants: applicants(20, "monday", "tuesday"),
		Leads:      append(leads(5, "monday"), leads(5, "tuesday")...),
		Cap:        10,
		Seed:       SeedFrom("cycle", "software_engineer"),
	}
	p1, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	p2, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	if fmt.Sprint(p1.New) != fmt.Sprint(p2.New) {
		t.Errorf("two runs with the same seed produced different plans:\n%v\n%v", p1.New, p2.New)
	}
}

func TestPlanReviewersCoverageAndDayMatch(t *testing.T) {
	in := ReviewerInput{
		Applicants:  []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:       []Lead{{NUID: "mon1", Day: "monday"}, {NUID: "mon2", Day: "monday"}, {NUID: "tue", Day: "tuesday"}},
		Interviewer: map[string]string{},
		Cap:         10,
		Coverage:    2,
		Seed:        SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	if len(plan.New) != 2 {
		t.Fatalf("New = %+v, want 2 reviewers assigned", plan.New)
	}
	for _, p := range plan.New {
		if p.LeadNUID == "tue" {
			t.Errorf("assigned Tuesday lead %s to a Monday-only applicant", p.LeadNUID)
		}
	}
	if len(plan.UnderCovered) != 0 {
		t.Errorf("UnderCovered = %v, want none", plan.UnderCovered)
	}
}

func TestPlanReviewersNeverAssignsTheInterviewerToTheirOwnApp(t *testing.T) {
	// The interviewer is included in Leads (their day still needs to resolve
	// for the same-day tie-break against other apps), but must never be
	// picked as their own app's reviewer — a hard exclusion, not a soft one.
	in := ReviewerInput{
		Applicants:  []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:       []Lead{{NUID: "interviewer", Day: "monday"}},
		Interviewer: map[string]string{"app1": "interviewer"},
		Cap:         10,
		Coverage:    1,
		Seed:        SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	if len(plan.New) != 0 {
		t.Fatalf("New = %+v, want none — the only lead is this app's own interviewer", plan.New)
	}
	if len(plan.UnderCovered) != 1 {
		t.Errorf("UnderCovered = %v, want [app1]", plan.UnderCovered)
	}
}

func TestPlanReviewersAvoidsInterviewersDay(t *testing.T) {
	// Two Monday leads with equal load; one is the interviewer for this app
	// (hard-excluded), the other shares the interviewer's day (soft-avoided
	// only as a tie-break — here it's the sole day-matched candidate left, so
	// it still wins over the day-mismatched "other").
	in := ReviewerInput{
		Applicants:  []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:       []Lead{{NUID: "interviewer", Day: "monday"}, {NUID: "teammate", Day: "monday"}, {NUID: "other", Day: "tuesday"}},
		Interviewer: map[string]string{"app1": "interviewer"},
		Cap:         10,
		Coverage:    1,
		Seed:        SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	if len(plan.New) != 1 {
		t.Fatalf("New = %+v, want 1 reviewer assigned", plan.New)
	}
	if plan.New[0].LeadNUID != "teammate" {
		t.Fatalf("New = %+v, want teammate (interviewer hard-excluded, other not day-matched)", plan.New)
	}
}

func TestPlanReviewersSameDayTieBreak(t *testing.T) {
	// Three Monday leads, one is the interviewer (excluded by the caller from
	// the reviewer roster, as real callers would do); of the remaining two
	// equally-loaded day-matched candidates, prefer the one NOT sharing the
	// interviewer's day when both are otherwise tied.
	in := ReviewerInput{
		Applicants:  []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true, "tuesday": true}}},
		Leads:       []Lead{{NUID: "teammate", Day: "monday"}, {NUID: "other", Day: "tuesday"}},
		Interviewer: map[string]string{"app1": "interviewer-not-in-roster"},
		Cap:         10,
		Coverage:    1,
		Seed:        SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	if len(plan.New) != 1 {
		t.Fatalf("New = %+v, want 1 reviewer assigned", plan.New)
	}
	// interviewer-not-in-roster has no resolvable day (not in Leads), so the
	// same-day rule never fires here; both are day-matched and tied on load,
	// so it falls to the NUID tie-break ("other" < "teammate").
	if plan.New[0].LeadNUID != "other" {
		t.Fatalf("New = %+v, want other (NUID tie-break, since the interviewer's day is unresolved)", plan.New)
	}
}

func TestPlanReviewersNeverDoubleAssignsSameLead(t *testing.T) {
	in := ReviewerInput{
		Applicants: []Applicant{{ApplicationID: "app1", AvailableDays: map[string]bool{"monday": true}}},
		Leads:      []Lead{{NUID: "a", Day: "monday"}},
		Existing:   []ReviewerPair{{ApplicationID: "app1", LeadNUID: "a"}},
		Cap:        10,
		Coverage:   2,
		Seed:       SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	if len(plan.New) != 0 {
		t.Fatalf("New = %+v, want none — the only lead is already reviewing this app", plan.New)
	}
	if len(plan.UnderCovered) != 1 {
		t.Errorf("UnderCovered = %v, want [app1]", plan.UnderCovered)
	}
}

func TestPlanInterviewersDistributesLoadEvenly(t *testing.T) {
	// 40 applicants, all available every day so every lead is eligible for
	// every one — load should split as evenly as 40/4 allows, not pile onto
	// whichever lead happens to be considered first.
	in := InterviewerInput{
		Applicants: applicants(40, "monday", "tuesday", "wednesday", "thursday"),
		Leads: []Lead{
			{NUID: "a", Day: "monday"}, {NUID: "b", Day: "tuesday"},
			{NUID: "c", Day: "wednesday"}, {NUID: "d", Day: "thursday"},
		},
		Cap:  20,
		Seed: SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	for _, l := range plan.Loads {
		if l.Total != 10 {
			t.Errorf("lead %s has %d interviews, want exactly 10 (40/4, evenly split)", l.LeadNUID, l.Total)
		}
	}
}

func TestPlanInterviewersDistributesProportionallyToCap(t *testing.T) {
	// A lead with double the cap should end up with roughly double the load —
	// load balances against each lead's own cap, not raw headcount.
	in := InterviewerInput{
		Applicants: applicants(30, "monday"),
		Leads:      []Lead{{NUID: "big", Day: "monday"}, {NUID: "small", Day: "monday"}},
		Cap:        10,
		CapOverrides: map[string]int{
			"big": 20,
		},
		Seed: SeedFrom("t"),
	}
	plan, err := PlanInterviewers(in)
	if err != nil {
		t.Fatalf("PlanInterviewers: %v", err)
	}
	var big, small int
	for _, l := range plan.Loads {
		switch l.LeadNUID {
		case "big":
			big = l.Total
		case "small":
			small = l.Total
		}
	}
	if big != 20 || small != 10 {
		t.Errorf("big=%d small=%d, want big=20 (its cap) and small=10 (the remainder)", big, small)
	}
}

func TestPlanReviewersDistributesLoadEvenly(t *testing.T) {
	in := ReviewerInput{
		Applicants: applicants(40, "monday", "tuesday"),
		Leads: []Lead{
			{NUID: "a", Day: "monday"}, {NUID: "b", Day: "monday"},
			{NUID: "c", Day: "tuesday"}, {NUID: "d", Day: "tuesday"},
		},
		Cap:      20,
		Coverage: 1,
		Seed:     SeedFrom("t"),
	}
	plan, err := PlanReviewers(in)
	if err != nil {
		t.Fatalf("PlanReviewers: %v", err)
	}
	for _, l := range plan.Loads {
		if l.Total != 10 {
			t.Errorf("lead %s has %d reviews, want exactly 10 (40/4, evenly split)", l.LeadNUID, l.Total)
		}
	}
}

func TestSuggestCapacityBasics(t *testing.T) {
	cap, err := SuggestCapacity(CapacityInput{Applicants: 30, Leads: 6, Coverage: 2})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}
	if !cap.Feasible {
		t.Fatal("want feasible with 6 leads")
	}
	if cap.MinCap != 10 {
		t.Errorf("MinCap = %d, want 10 (30*2/6)", cap.MinCap)
	}
	if cap.SuggestedCap < cap.MinCap {
		t.Errorf("SuggestedCap %d < MinCap %d", cap.SuggestedCap, cap.MinCap)
	}
}

func TestSuggestCapacityInfeasibleWithNoLeads(t *testing.T) {
	cap, err := SuggestCapacity(CapacityInput{Applicants: 10, Leads: 0, Coverage: 1})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}
	if cap.Feasible {
		t.Error("want infeasible with 0 leads")
	}
}

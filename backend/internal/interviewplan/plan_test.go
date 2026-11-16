package interviewplan

import (
	"fmt"
	"slices"
	"testing"
)

func people(ids ...string) []Unit {
	out := make([]Unit, len(ids))
	for i, id := range ids {
		out[i] = Unit{ID: id, Members: []string{id}}
	}
	return out
}

func apps(prefix string, n, need int) []Applicant {
	out := make([]Applicant, n)
	for i := range out {
		out[i] = Applicant{ID: fmt.Sprintf("%s%02d", prefix, i), Need: need}
	}
	return out
}

func byApp(r Result) map[string][]string {
	out := map[string][]string{}
	for _, p := range r.Picks {
		out[p.ApplicationID] = append(out[p.ApplicationID], p.Unit.ID)
	}
	return out
}

func TestPlanBalancesAndMeetsNeed(t *testing.T) {
	r := Plan([]Opening{{RoleID: "eng", Units: people("a", "b", "c", "d"), Applicants: apps("x", 6, 2)}}, nil, false)
	if len(r.Picks) != 12 || len(r.Short) != 0 {
		t.Fatalf("picks %d short %v", len(r.Picks), r.Short)
	}
	for n, l := range r.Loads {
		if l != 3 {
			t.Errorf("%s has %d, want 3", n, l)
		}
	}
	for app, got := range byApp(r) {
		if len(got) != 2 || got[0] == got[1] {
			t.Errorf("%s got %v", app, got)
		}
	}
}

func TestPlanCountsExistingLoad(t *testing.T) {
	r := Plan([]Opening{{RoleID: "eng", Units: people("a", "b"), Applicants: apps("x", 2, 1)}}, map[string]int{"a": 5}, false)
	if r.Loads["b"] != 2 || r.Loads["a"] != 5 {
		t.Errorf("loads %v", r.Loads)
	}
}

func TestPlanBalancesAcrossOpenings(t *testing.T) {
	r := Plan([]Opening{
		{RoleID: "eng", Units: people("a", "b"), Applicants: apps("e", 4, 1)},
		{RoleID: "des", Units: people("b"), Applicants: apps("d", 2, 1)},
	}, nil, false)
	if r.Loads["a"] != 3 || r.Loads["b"] != 3 {
		t.Errorf("shared person should end level with the other: %v", r.Loads)
	}
}

func TestPlanHonoursBlocked(t *testing.T) {
	x := Applicant{ID: "x", Need: 2, Blocked: map[string]bool{"a": true}}
	r := Plan([]Opening{{RoleID: "eng", Units: people("a", "b"), Applicants: []Applicant{x}}}, nil, false)
	if got := byApp(r)["x"]; !slices.Equal(got, []string{"b"}) {
		t.Errorf("got %v", got)
	}
	if !slices.Equal(r.Short, []string{"x"}) {
		t.Errorf("short %v", r.Short)
	}
	if x.Blocked["b"] {
		t.Error("input was mutated")
	}
}

func TestPlanSkipsSatisfiedApplicants(t *testing.T) {
	r := Plan([]Opening{{RoleID: "eng", Units: people("a"), Applicants: []Applicant{{ID: "x", Need: 0}}}}, nil, false)
	if len(r.Picks) != 0 || len(r.Short) != 0 {
		t.Errorf("%+v", r)
	}
}

func TestPlanMatchesSlots(t *testing.T) {
	units := []Unit{{ID: "a", Members: []string{"a"}, Slot: "tue"}, {ID: "b", Members: []string{"b"}, Slot: "wed"}, {ID: "c", Members: []string{"c"}}}
	applicants := []Applicant{
		{ID: "x", Need: 1, Slots: []string{"wed"}},
		{ID: "y", Need: 1, Slots: []string{"fri"}},
		{ID: "z", Need: 1},
	}
	r := Plan([]Opening{{RoleID: "eng", Units: units, Applicants: applicants}}, map[string]int{"b": 9}, true)
	got := byApp(r)
	if !slices.Equal(got["x"], []string{"b"}) {
		t.Errorf("x can only make wed: %v", got["x"])
	}
	if len(got["y"]) != 1 || len(got["z"]) != 1 {
		t.Errorf("y and z still get someone: %v", got)
	}
	if !slices.Equal(r.NoSlotMatch, []string{"y"}) {
		t.Errorf("only y is flagged, not z who gave no slots: %v", r.NoSlotMatch)
	}

	off := Plan([]Opening{{RoleID: "eng", Units: units, Applicants: applicants}}, map[string]int{"b": 9}, false)
	if slices.Equal(byApp(off)["x"], []string{"b"}) || len(off.NoSlotMatch) != 0 {
		t.Errorf("without matching, load wins: %v %v", byApp(off), off.NoSlotMatch)
	}
}

func TestPlanPanelsAsUnits(t *testing.T) {
	panels := []Unit{{ID: "p1", Members: []string{"a", "b"}}, {ID: "p2", Members: []string{"c", "d"}}}
	applicants := []Applicant{
		{ID: "x", Need: 1},
		{ID: "y", Need: 1},
		{ID: "z", Need: 1, Blocked: map[string]bool{"c": true}},
	}
	r := Plan([]Opening{{RoleID: "eng", Units: panels, Applicants: applicants}}, nil, false)
	got := byApp(r)
	if !slices.Equal(got["z"], []string{"p1"}) {
		t.Errorf("one blocked member rules out the whole panel: %v", got["z"])
	}
	if got["x"][0] == got["y"][0] {
		t.Errorf("panels should alternate: %v", got)
	}
}

func TestPanelsKeepSlotsTogether(t *testing.T) {
	slot := map[string]string{"a": "tue", "b": "wed", "c": "tue", "d": "wed", "e": "tue"}
	got := Panels([]string{"a", "b", "c", "d", "e", "f"}, slot, 2)
	want := [][]string{{"a", "c"}, {"b", "d"}, {"f", "e"}}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("got %v, want %v", got, want)
	}
	if got := Panels([]string{"a", "b", "c"}, nil, 2); fmt.Sprint(got) != "[[a b] [c]]" {
		t.Errorf("short last panel: %v", got)
	}
}

package assign

import "testing"

// The headline case: 80 applications, four teams of two, two reviewers each.
// 160 slots over 8 leads is exactly 20 apiece, so a cap of 15 cannot work.
func TestSuggestCapacityEvenTeams(t *testing.T) {
	got, err := SuggestCapacity(CapacityInput{
		Applications: 80,
		Teams:        teams(4, 2),
		Coverage:     2,
	})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}

	if !got.Feasible {
		t.Fatal("expected feasible")
	}
	if got.MinCap != 20 {
		t.Errorf("MinCap = %d, want 20", got.MinCap)
	}
	if got.EvenSplit != 20 {
		t.Errorf("EvenSplit = %d, want 20", got.EvenSplit)
	}
	if got.SuggestedCap <= got.MinCap {
		t.Errorf("SuggestedCap = %d, want headroom above MinCap %d", got.SuggestedCap, got.MinCap)
	}
	if got.RequiredSlots != 160 {
		t.Errorf("RequiredSlots = %d, want 160", got.RequiredSlots)
	}
	if got.MaxCoverage != 4 {
		t.Errorf("MaxCoverage = %d, want 4", got.MaxCoverage)
	}
}

// The trap the button exists to catch: with lopsided teams the even split badly
// understates the cap, because the five-lead team can only review each of the
// 80 applications once no matter how high its leads' caps go.
func TestSuggestCapacityUnevenTeamsExceedEvenSplit(t *testing.T) {
	got, err := SuggestCapacity(CapacityInput{
		Applications: 80,
		Teams: []Team{
			{Name: "big", LeadNUIDs: []string{"a", "b", "c", "d", "e"}},
			{Name: "solo1", LeadNUIDs: []string{"f"}},
			{Name: "solo2", LeadNUIDs: []string{"g"}},
		},
		Coverage: 2,
	})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}

	if got.EvenSplit != 23 {
		t.Errorf("EvenSplit = %d, want 23", got.EvenSplit)
	}
	if got.MinCap != 40 {
		t.Errorf("MinCap = %d, want 40 (big team tops out at 80 reviews, leaving 80 for two solo leads)", got.MinCap)
	}
	if len(got.Notes) == 0 {
		t.Error("expected a note explaining why the minimum exceeds the even split")
	}
}

// MinCap must be exactly the threshold: feasible at MinCap, infeasible below.
func TestSuggestCapacityMinCapIsTight(t *testing.T) {
	cases := []struct {
		name     string
		apps     int
		teams    []Team
		coverage int
	}{
		{"even", 80, teams(4, 2), 2},
		{"uneven", 80, []Team{
			{Name: "big", LeadNUIDs: []string{"a", "b", "c", "d", "e"}},
			{Name: "s1", LeadNUIDs: []string{"f"}},
			{Name: "s2", LeadNUIDs: []string{"g"}},
		}, 2},
		{"triple-coverage", 50, teams(5, 2), 3},
		{"solo-teams", 30, teams(3, 1), 3},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := SuggestCapacity(CapacityInput{
				Applications: tc.apps, Teams: tc.teams, Coverage: tc.coverage,
			})
			if err != nil {
				t.Fatalf("SuggestCapacity: %v", err)
			}

			sizes := make([]int, len(tc.teams))
			for i, tm := range tc.teams {
				sizes[i] = len(tm.LeadNUIDs)
			}
			need := tc.apps * tc.coverage

			if p := placeable(sizes, got.MinCap, tc.apps); p < need {
				t.Errorf("MinCap %d places only %d of %d slots", got.MinCap, p, need)
			}
			if got.MinCap > 0 {
				if p := placeable(sizes, got.MinCap-1, tc.apps); p >= need {
					t.Errorf("MinCap %d is not minimal: %d also suffices", got.MinCap, got.MinCap-1)
				}
			}
		})
	}
}

// The suggested cap must actually deliver full coverage when fed to the planner.
func TestSuggestedCapAchievesFullCoverage(t *testing.T) {
	layouts := []struct {
		name  string
		apps  int
		teams []Team
		cov   int
	}{
		{"even-pairs", 80, teams(4, 2), 2},
		{"uneven", 60, []Team{
			{Name: "solo", LeadNUIDs: []string{"a"}},
			{Name: "pair", LeadNUIDs: []string{"b", "c"}},
			{Name: "trio", LeadNUIDs: []string{"d", "e", "f"}},
		}, 2},
		{"five-teams-triple", 75, teams(5, 2), 3},
		{"solo-teams", 40, teams(4, 1), 2},
	}

	for _, l := range layouts {
		t.Run(l.name, func(t *testing.T) {
			cap, err := SuggestCapacity(CapacityInput{
				Applications: l.apps, Teams: l.teams, Coverage: l.cov,
			})
			if err != nil {
				t.Fatalf("SuggestCapacity: %v", err)
			}

			in := Input{
				ApplicationIDs: apps(l.apps),
				Teams:          l.teams,
				Cap:            cap.SuggestedCap,
				Coverage:       l.cov,
				Seed:           SeedFrom(l.name),
			}
			plan, err := Compute(in)
			if err != nil {
				t.Fatalf("Compute: %v", err)
			}
			assertInvariants(t, in, plan)

			if len(plan.UnderCovered) != 0 {
				t.Errorf("suggested cap %d left %d application(s) under-covered",
					cap.SuggestedCap, len(plan.UnderCovered))
			}
		})
	}
}

// Too few teams is not a capacity problem — no cap can fix it.
func TestSuggestCapacityInfeasibleWithTooFewTeams(t *testing.T) {
	got, err := SuggestCapacity(CapacityInput{
		Applications: 40,
		Teams:        teams(2, 4),
		Coverage:     3,
	})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}

	if got.Feasible {
		t.Error("expected infeasible with 2 teams and coverage 3")
	}
	if got.MaxCoverage != 2 {
		t.Errorf("MaxCoverage = %d, want 2", got.MaxCoverage)
	}
	if len(got.Notes) == 0 {
		t.Error("expected a note explaining the team-count ceiling")
	}
}

func TestSuggestCapacityEmptyPool(t *testing.T) {
	got, err := SuggestCapacity(CapacityInput{
		Applications: 0,
		Teams:        teams(3, 2),
		Coverage:     2,
	})
	if err != nil {
		t.Fatalf("SuggestCapacity: %v", err)
	}
	if got.MinCap != 0 || got.SuggestedCap != 0 {
		t.Errorf("MinCap/SuggestedCap = %d/%d, want 0/0 for an empty pool", got.MinCap, got.SuggestedCap)
	}
}

func TestSuggestCapacityRejectsBadInput(t *testing.T) {
	if _, err := SuggestCapacity(CapacityInput{Applications: 10, Teams: teams(2, 1), Coverage: 0}); err == nil {
		t.Error("expected an error for coverage of 0")
	}
	if _, err := SuggestCapacity(CapacityInput{
		Applications: 10,
		Teams:        []Team{{Name: "empty"}},
		Coverage:     1,
	}); err == nil {
		t.Error("expected an error for a team with no leads")
	}
}

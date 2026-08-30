package store

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestSnakePosition(t *testing.T) {
	// Three teams: round 1 runs 0,1,2 and round 2 comes back 2,1,0 — so the
	// team in the last seat picks 3 and 4 back to back.
	want := []int{0, 1, 2, 2, 1, 0, 0, 1, 2}
	for i, w := range want {
		if got := SnakePosition(i+1, 3); got != w {
			t.Errorf("pick %d: got seat %d, want %d", i+1, got, w)
		}
	}
}

func TestSnakePositionSingleTeam(t *testing.T) {
	for pick := 1; pick <= 4; pick++ {
		if got := SnakePosition(pick, 1); got != 0 {
			t.Errorf("pick %d: got seat %d, want 0", pick, got)
		}
	}
}

func TestSnakePositionGuards(t *testing.T) {
	if got := SnakePosition(1, 0); got != 0 {
		t.Errorf("no teams: got %d, want 0", got)
	}
	if got := SnakePosition(0, 3); got != 0 {
		t.Errorf("no pick: got %d, want 0", got)
	}
}

func TestNextOpenSlot(t *testing.T) {
	cases := []struct {
		name  string
		taken []int
		total int
		want  int
	}{
		{"empty board", nil, 6, 1},
		{"in order", []int{1, 2, 3}, 6, 4},
		// The reason slots are keyed rather than appended: undoing pick 2 puts
		// that slot back on the clock, not the end of the board.
		{"hole from an undo", []int{1, 3, 4}, 6, 2},
		{"full", []int{1, 2, 3, 4, 5, 6}, 6, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nextOpenSlot(tc.taken, tc.total); got != tc.want {
				t.Errorf("got %d, want %d", got, tc.want)
			}
		})
	}
}

func slotTeams(owners []models.DraftSlot) map[int]string {
	out := make(map[int]string, len(owners))
	for _, o := range owners {
		out[o.PickNumber] = o.DraftTeamID
	}
	return out
}

func teamsInOrder(ids ...string) []models.DraftTeamDetail {
	teams := make([]models.DraftTeamDetail, len(ids))
	for i, id := range ids {
		teams[i] = models.DraftTeamDetail{DraftTeam: models.DraftTeam{ID: id, Position: i}}
	}
	return teams
}

func picksBy(pairs map[int]string) []models.DraftPickDetail {
	picks := make([]models.DraftPickDetail, 0, len(pairs))
	for slot, team := range pairs {
		picks = append(picks, models.DraftPickDetail{
			DraftPick: models.DraftPick{PickNumber: slot, DraftTeamID: team},
		})
	}
	return picks
}

func assertOwners(t *testing.T, got map[int]string, want map[int]string) {
	t.Helper()
	for slot, team := range want {
		if got[slot] != team {
			t.Errorf("slot %d: got %q, want %q", slot, got[slot], team)
		}
	}
}

// An untouched board is the plain snake, so allowing reordering changed
// nothing for a draft nobody has reordered.
func TestSlotOwnersMatchesSnakeWhenNothingPicked(t *testing.T) {
	got := slotTeams(SlotOwners(teamsInOrder("A", "B", "C"), nil, 2))
	assertOwners(t, got, map[int]string{1: "A", 2: "B", 3: "C", 4: "C", 5: "B", 6: "A"})
}

// Reordering after a round is complete leaves that round's picks with the
// teams that made them, and applies the new order from there on.
func TestSlotOwnersKeepsCompletedRoundWithItsPickers(t *testing.T) {
	got := slotTeams(SlotOwners(
		teamsInOrder("C", "A", "B"),
		picksBy(map[int]string{1: "A", 2: "B", 3: "C"}),
		2,
	))
	assertOwners(t, got, map[int]string{
		1: "A", 2: "B", 3: "C",
		// Round 2 runs back up the new order C, A, B.
		4: "B", 5: "A", 6: "C",
	})
}

// The mid-round case: picks 4 and 5 are in, the chief reorders, and the one
// slot left in the round goes to the only team yet to pick in it.
func TestSlotOwnersGivesRestOfRoundToTeamsYetToPick(t *testing.T) {
	got := slotTeams(SlotOwners(
		teamsInOrder("C", "A", "B"),
		picksBy(map[int]string{1: "A", 2: "B", 3: "C", 4: "A", 5: "B"}),
		3,
	))
	assertOwners(t, got, map[int]string{
		4: "A", 5: "B", 6: "C",
		// The partial round doesn't bleed into the next one.
		7: "C", 8: "A", 9: "B",
	})
	if got[4] == got[5] || got[5] == got[6] || got[4] == got[6] {
		t.Errorf("round 2 owners %q/%q/%q are not distinct", got[4], got[5], got[6])
	}
}

// Every slot gets exactly one owner, so no cell renders without a team and
// none is claimed twice.
func TestSlotOwnersCoversEverySlotOnce(t *testing.T) {
	owners := SlotOwners(
		teamsInOrder("A", "B", "C"),
		picksBy(map[int]string{2: "C"}),
		4,
	)
	if len(owners) != 12 {
		t.Fatalf("got %d slots, want 12", len(owners))
	}
	seen := map[int]bool{}
	for _, o := range owners {
		if seen[o.PickNumber] {
			t.Errorf("slot %d assigned twice", o.PickNumber)
		}
		if o.DraftTeamID == "" {
			t.Errorf("slot %d has no owner", o.PickNumber)
		}
		seen[o.PickNumber] = true
	}
}

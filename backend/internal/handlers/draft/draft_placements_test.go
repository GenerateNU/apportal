package draft

import (
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func placementDraft(enabled bool, rounds int) models.Draft {
	return models.Draft{Status: models.DraftSetup, Rounds: rounds, PlacementsEnabled: enabled}
}

func TestTotalRoundsAddsPlacementRounds(t *testing.T) {
	if got := totalRounds(placementDraft(false, 3)); got != 3 {
		t.Errorf("without placements: got %d, want 3", got)
	}
	if got := totalRounds(placementDraft(true, 3)); got != 3+PlacementRounds {
		t.Errorf("with placements: got %d, want %d", got, 3+PlacementRounds)
	}
}

func TestPlacementSlotsAreTheFirstRounds(t *testing.T) {
	d := placementDraft(true, 1)
	teams := teamsInOrder("a", "b", "c")
	owners := slotTeams(SlotOwners(teams, nil, totalRounds(d)))
	assertOwners(t, owners, map[int]string{
		1: "a", 2: "b", 3: "c",
		4: "c", 5: "b", 6: "a",
		7: "a", 8: "b", 9: "c",
	})
	for slot := 1; slot <= 9; slot++ {
		want := slot <= PlacementRounds*3
		if got := isPlacementSlot(d, 3, slot); got != want {
			t.Errorf("slot %d: placement = %v, want %v", slot, got, want)
		}
	}
	if isPlacementSlot(d, 3, 0) {
		t.Error("slot 0 means 'on the clock', never a placement")
	}
	if isPlacementSlot(placementDraft(false, 3), 3, 1) {
		t.Error("a draft without placements has no placement slots")
	}
}

func TestPlacementsFilledNeedsEverySlot(t *testing.T) {
	d := placementDraft(true, 1)
	full := picksBy(map[int]string{1: "a", 2: "b", 3: "b", 4: "a"})
	if !placementsFilled(d, 2, full) {
		t.Error("all four placement slots filled should count as filled")
	}
	if placementsFilled(d, 2, picksBy(map[int]string{1: "a", 2: "b", 3: "b"})) {
		t.Error("three of four placement slots isn't filled")
	}
	if placementsFilled(d, 2, picksBy(map[int]string{1: "a", 2: "b", 3: "b", 5: "a"})) {
		t.Error("a pick past the placement rounds doesn't fill a placement slot")
	}
	if placementsFilled(placementDraft(false, 2), 2, full) {
		t.Error("a draft without placements is never 'filled'")
	}
}

func TestWithoutUnreleasedHidesPlacementsUntilRelease(t *testing.T) {
	d := placementDraft(true, 1)
	board := models.DraftBoard{
		Draft: d,
		Teams: teamsInOrder("a", "b"),
		Picks: picksBy(map[int]string{1: "b", 2: "a"}),
	}
	board.Slots = SlotOwners(board.Teams, board.Picks, totalRounds(d))

	hidden := withoutUnreleased(board)
	if len(hidden.Picks) != 0 {
		t.Fatalf("unreleased placements leaked: %+v", hidden.Picks)
	}
	if got := slotTeams(hidden.Slots); got[1] != "a" || got[2] != "b" {
		t.Errorf("hidden slots should fall back to plain snake order, got %v", got)
	}

	released := time.Now()
	board.PlacementsReleasedAt = &released
	if got := withoutUnreleased(board); len(got.Picks) != 2 {
		t.Errorf("released placements should show, got %d picks", len(got.Picks))
	}

	board.PlacementsReleasedAt = nil
	board.Status = models.DraftActive
	if got := withoutUnreleased(board); len(got.Picks) != 2 {
		t.Errorf("a live draft shows every pick, got %d", len(got.Picks))
	}
}

func TestRequirePlacementEditable(t *testing.T) {
	if err := requirePlacementEditable(placementDraft(false, 2), 2, 1); err == nil {
		t.Error("a draft without placements can't take picks in setup")
	}
	d := placementDraft(true, 2)
	if err := requirePlacementEditable(d, 2, 1); err != nil {
		t.Errorf("slot 1 is a placement slot: %v", err)
	}
	if err := requirePlacementEditable(d, 2, 5); err == nil {
		t.Error("slot 5 is past the placement rounds")
	}
	if err := requirePlacementEditable(d, 2, 0); err == nil {
		t.Error("placements need an explicit slot")
	}
	released := time.Now()
	d.PlacementsReleasedAt = &released
	if err := requirePlacementEditable(d, 2, 1); err == nil {
		t.Error("released placements are locked")
	}
}

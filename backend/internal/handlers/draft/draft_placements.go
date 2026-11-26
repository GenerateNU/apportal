package draft

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const PlacementRounds = 2

func placementRounds(d models.Draft) int {
	if d.PlacementsEnabled {
		return PlacementRounds
	}
	return 0
}

func totalRounds(d models.Draft) int {
	return d.Rounds + placementRounds(d)
}

func placementSlotCount(d models.Draft, teamCount int) int {
	return placementRounds(d) * teamCount
}

func isPlacementSlot(d models.Draft, teamCount, slot int) bool {
	return slot >= 1 && slot <= placementSlotCount(d, teamCount)
}

func placementsFilled(d models.Draft, teamCount int, picks []models.DraftPickDetail) bool {
	want := placementSlotCount(d, teamCount)
	filled := 0
	for _, p := range picks {
		if isPlacementSlot(d, teamCount, p.PickNumber) {
			filled++
		}
	}
	return want > 0 && filled == want
}

func placementsVisible(d models.Draft) bool {
	return d.Status != models.DraftSetup || d.PlacementsReleasedAt != nil
}

func withoutUnreleased(board models.DraftBoard) models.DraftBoard {
	if placementsVisible(board.Draft) {
		return board
	}
	board.Picks = []models.DraftPickDetail{}
	board.Slots = SlotOwners(board.Teams, nil, totalRounds(board.Draft))
	return board
}

func requirePlacementEditable(d models.Draft, teamCount, slot int) error {
	if !d.PlacementsEnabled {
		return huma.Error409Conflict("the draft hasn't started")
	}
	if d.PlacementsReleasedAt != nil {
		return huma.Error409Conflict("placements are released; take them back before changing them")
	}
	if !isPlacementSlot(d, teamCount, slot) {
		return huma.Error409Conflict("before the draft starts, only the placement rounds can be filled")
	}
	return nil
}

package draft

import (
	"context"
	"errors"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// draftService runs the snake draft: one board per (cycle, applicant role),
// teams are preference_lists groups, and a single operator drives it. Reads
// are open to any reviewer so the room can follow along; every write is
// chief-only.
type draftService struct {
	draftDB *DraftDB
}

// maxDraftRounds bounds the board so one bad number can't render thousands of
// empty slots.
const maxDraftRounds = 50

// parseDraftRole rejects a missing or unknown role rather than silently
// picking one — the two boards are independent and a wrong guess would show
// the other role's picks.
func parseDraftRole(raw string) (models.Role, error) {
	role := models.Role(raw)
	if !role.Valid() {
		return "", huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	return role, nil
}

func (s *draftService) board(ctx context.Context, in *DraftScopedInput) (*DraftBoardOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := parseDraftRole(in.Role)
	if err != nil {
		return nil, err
	}
	draft, err := s.draftDB.GetDraft(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	board, err := s.draftDB.DraftBoard(ctx, draft)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

func (s *draftService) open(ctx context.Context, in *OpenDraftInput) (*DraftOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if !in.Body.Role.Valid() {
		return nil, huma.Error422UnprocessableEntity("role must be 'software_engineer' or 'software_designer'")
	}
	rounds := in.Body.Rounds
	if rounds == 0 {
		rounds = 1
	}
	if rounds > maxDraftRounds {
		return nil, huma.Error422UnprocessableEntity("rounds is too large")
	}
	draft, err := s.draftDB.CreateDraft(ctx, in.ID, in.Body.Role, rounds, utils.CurrentActor(ctx).NUID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftOutput{Body: draft}, nil
}

func (s *draftService) update(ctx context.Context, in *UpdateDraftInput) (*DraftOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("status must be 'setup', 'active', or 'complete'")
	}
	if in.Body.Rounds != nil && *in.Body.Rounds > maxDraftRounds {
		return nil, huma.Error422UnprocessableEntity("rounds is too large")
	}
	draft, err := s.draftDB.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// Shrinking the board would orphan picks in the slots it cuts off, so the
	// floor is whatever has already been picked.
	if in.Body.Rounds != nil {
		picks, err := s.draftDB.ListDraftPicks(ctx, draft.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		teams, err := s.draftDB.ListDraftTeams(ctx, draft.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if len(teams) > 0 {
			highest := 0
			for _, p := range picks {
				if p.PickNumber > highest {
					highest = p.PickNumber
				}
			}
			if *in.Body.Rounds*len(teams) < highest {
				return nil, huma.Error422UnprocessableEntity("rounds would cut off picks already made")
			}
		}
	}
	updated, err := s.draftDB.UpdateDraft(ctx, in.ID, DraftUpdate{
		Status: in.Body.Status,
		Rounds: in.Body.Rounds,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftOutput{Body: updated}, nil
}

func (s *draftService) setTeams(ctx context.Context, in *SetDraftTeamsInput) (*DraftBoardOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	draft, err := s.draftDB.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// Mid-draft the order can still be corrected, but the team set can't:
	// dropping a team cascades its picks away, losing the stage changes they
	// made. A pick already made keeps the team that made it (see
	// SlotOwners), so reordering only moves who's up next.
	switch draft.Status {
	case models.DraftComplete:
		return nil, huma.Error409Conflict("a completed draft's order can't be changed")
	case models.DraftActive:
		existing, err := s.draftDB.ListDraftTeams(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if !sameTeams(existing, in.Body.PreferenceListIDs) {
			return nil, huma.Error409Conflict("teams can't be added or removed once picking has started — only reordered")
		}
	}
	if err := s.draftDB.SetDraftTeams(ctx, in.ID, in.Body.PreferenceListIDs); err != nil {
		return nil, utils.StoreErr(err)
	}
	board, err := s.draftDB.DraftBoard(ctx, draft)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

// sameTeams reports whether ids names exactly the teams already seated, in
// any order.
func sameTeams(existing []models.DraftTeamDetail, ids []string) bool {
	if len(existing) != len(ids) {
		return false
	}
	seated := make(map[string]bool, len(existing))
	for _, t := range existing {
		seated[t.PreferenceListID] = true
	}
	for _, id := range ids {
		if !seated[id] {
			return false
		}
		delete(seated, id)
	}
	return len(seated) == 0
}

func (s *draftService) pick(ctx context.Context, in *MakeDraftPickInput) (*DraftPickOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID == "" {
		return nil, huma.Error422UnprocessableEntity("application_id is required")
	}
	draft, err := s.draftDB.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if draft.Status != models.DraftActive {
		return nil, huma.Error409Conflict("the draft isn't active")
	}
	pick, err := s.draftDB.MakeDraftPick(ctx, draft, in.Body.PickNumber, in.Body.ApplicationID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		if errors.Is(err, ErrDraftSlotTaken) {
			return nil, huma.Error409Conflict("that slot has already been filled")
		}
		return nil, utils.StoreErr(err)
	}
	return &DraftPickOutput{Body: pick}, nil
}

func (s *draftService) replacePick(ctx context.Context, in *ReplaceDraftPickInput) (*DraftPickOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID == "" {
		return nil, huma.Error422UnprocessableEntity("application_id is required")
	}
	draft, err := s.draftDB.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if draft.Status == models.DraftSetup {
		return nil, huma.Error409Conflict("the draft hasn't started")
	}
	pick, err := s.draftDB.ReplaceDraftPick(ctx, draft, in.PickNumber, in.Body.ApplicationID, utils.CurrentActor(ctx).NUID)
	if err != nil {
		switch {
		case errors.Is(err, ErrNoChange):
			// Re-picking the applicant already in the slot is a no-op, not a
			// failure — hand back the slot as it stands.
			picks, listErr := s.draftDB.ListDraftPicks(ctx, draft.ID)
			if listErr != nil {
				return nil, utils.StoreErr(listErr)
			}
			for _, p := range picks {
				if p.PickNumber == in.PickNumber {
					return &DraftPickOutput{Body: p.DraftPick}, nil
				}
			}
			return nil, huma.Error404NotFound("not found")
		case errors.Is(err, ErrDraftAlreadyPicked):
			return nil, huma.Error409Conflict("that applicant is already picked in another slot")
		}
		return nil, utils.StoreErr(err)
	}
	return &DraftPickOutput{Body: pick}, nil
}

func (s *draftService) removePick(ctx context.Context, in *RemoveDraftPickInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.draftDB.RemoveDraftPick(ctx, in.ID, in.PickNumber); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *draftService) reset(ctx context.Context, in *DraftIDInput) (*DraftBoardOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.draftDB.ResetDraft(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	draft, err := s.draftDB.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	board, err := s.draftDB.DraftBoard(ctx, draft)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

func (s *draftService) delete(ctx context.Context, in *DraftIDInput) (*struct{}, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	if err := s.draftDB.DeleteDraft(ctx, in.ID); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *draftService) drafted(ctx context.Context, in *utils.CycleScopedInput) (*DraftedApplicationsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	taken, err := s.draftDB.DraftedApplicationIDs(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DraftedApplicationsOutput{Body: taken}, nil
}

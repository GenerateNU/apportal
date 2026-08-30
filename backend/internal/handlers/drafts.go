package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// maxDraftRounds bounds the board so one bad number can't render thousands of
// empty slots.
const maxDraftRounds = 50

// draftHandler runs the snake draft: one board per (cycle, applicant role),
// teams are preference_lists groups, and a single operator drives it. Reads
// are open to any reviewer so the room can follow along; every write is
// chief-only.
type draftHandler struct {
	store *store.Store
}

func (h *draftHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-draft-board",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/draft",
		Summary:     "The draft board for a cycle and applicant role",
		Description: "Reviewer only. The team order, every pick made, and which slot is on the clock. 404 until a chief opens the board.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.board)

	huma.Register(api, huma.Operation{
		OperationID: "open-draft",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/draft",
		Summary:     "Open the draft board for a cycle and applicant role",
		Description: "Chief only. Idempotent — opening an existing board returns it rather than failing.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusUnprocessableEntity},
	}, h.open)

	huma.Register(api, huma.Operation{
		OperationID: "update-draft",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}",
		Summary:     "Set a draft's status or round count",
		Description: "Chief only. Moving to active starts the picking; rounds may be raised mid-draft but never below the picks already made.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.update)

	huma.Register(api, huma.Operation{
		OperationID: "set-draft-teams",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}/teams",
		Summary:     "Set the draft order",
		Description: "Chief only. In setup the given preference list groups become the seats, in the given order. While the draft is active the order may still be changed, but the set of teams may not: picks already made stay with the team that made them, and the rest of the round goes to the teams yet to pick in it.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.setTeams)

	huma.Register(api, huma.Operation{
		OperationID: "make-draft-pick",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/picks",
		Summary:     "Claim an applicant for the team on the clock",
		Description: "Chief only. Fills the lowest open slot unless pick_number names another, and moves the applicant to the accepted stage.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.pick)

	huma.Register(api, huma.Operation{
		OperationID: "replace-draft-pick",
		Method:      http.MethodPut,
		Path:        "/drafts/{id}/picks/{pick_number}",
		Summary:     "Swap the applicant in a slot that's already been picked",
		Description: "Chief only. Done in place, so the slot never reopens and the team on the clock doesn't change. The outgoing applicant returns to their previous stage and the incoming one moves to accepted.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity},
	}, h.replacePick)

	huma.Register(api, huma.Operation{
		OperationID:   "remove-draft-pick",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}/picks/{pick_number}",
		Summary:       "Empty a slot and undo its stage change",
		Description:   "Chief only. The applicant returns to the stage they were in before the pick, and the slot goes back on the clock.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.removePick)

	huma.Register(api, huma.Operation{
		OperationID: "reset-draft",
		Method:      http.MethodPost,
		Path:        "/drafts/{id}/reset",
		Summary:     "Clear every pick and return the board to setup",
		Description: "Chief only. Each applicant goes back to the stage they were in before their pick; the team order is kept, so a rehearsal can be wiped without rebuilding it.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.reset)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-draft",
		Method:        http.MethodDelete,
		Path:          "/drafts/{id}",
		Summary:       "Delete a draft board",
		Description:   "Chief only. Undoes every pick's stage change, then removes the board, its order, and its picks.",
		Tags:          []string{"Draft"},
		DefaultStatus: http.StatusNoContent,
		Errors:        []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, h.delete)

	huma.Register(api, huma.Operation{
		OperationID: "list-drafted-applications",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/drafted",
		Summary:     "Which applicants a cycle's drafts have already claimed",
		Description: "Reviewer only. Application id to the team name that took them, for marking them as taken wherever they're still listed.",
		Tags:        []string{"Draft"},
		Errors:      []int{http.StatusUnauthorized},
	}, h.drafted)
}

type DraftBoardOutput struct {
	Body models.DraftBoard
}

type DraftOutput struct {
	Body models.Draft
}

type DraftScopedInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role: software_engineer or software_designer"`
}

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

func (h *draftHandler) board(ctx context.Context, in *DraftScopedInput) (*DraftBoardOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := parseDraftRole(in.Role)
	if err != nil {
		return nil, err
	}
	draft, err := h.store.GetDraft(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

type OpenDraftInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role   models.Role `json:"role" doc:"Applicant role: software_engineer or software_designer"`
		Rounds int         `json:"rounds,omitempty" doc:"How many times around the board; defaults to 1" minimum:"0"`
	}
}

func (h *draftHandler) open(ctx context.Context, in *OpenDraftInput) (*DraftOutput, error) {
	if err := requireChief(ctx); err != nil {
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
	draft, err := h.store.CreateDraft(ctx, in.ID, in.Body.Role, rounds, currentActor(ctx).NUID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftOutput{Body: draft}, nil
}

type UpdateDraftInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		Status *models.DraftStatus `json:"status,omitempty" doc:"setup, active, or complete"`
		Rounds *int                `json:"rounds,omitempty" doc:"How many times around the board" minimum:"1"`
	}
}

func (h *draftHandler) update(ctx context.Context, in *UpdateDraftInput) (*DraftOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.Status != nil && !in.Body.Status.Valid() {
		return nil, huma.Error422UnprocessableEntity("status must be 'setup', 'active', or 'complete'")
	}
	if in.Body.Rounds != nil && *in.Body.Rounds > maxDraftRounds {
		return nil, huma.Error422UnprocessableEntity("rounds is too large")
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// Shrinking the board would orphan picks in the slots it cuts off, so the
	// floor is whatever has already been picked.
	if in.Body.Rounds != nil {
		picks, err := h.store.ListDraftPicks(ctx, draft.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		teams, err := h.store.ListDraftTeams(ctx, draft.ID)
		if err != nil {
			return nil, storeErr(err)
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
	updated, err := h.store.UpdateDraft(ctx, in.ID, store.DraftUpdate{
		Status: in.Body.Status,
		Rounds: in.Body.Rounds,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftOutput{Body: updated}, nil
}

type SetDraftTeamsInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		PreferenceListIDs []string `json:"preference_list_ids" doc:"The drafting groups, in the order they pick" minItems:"1" maxItems:"50"`
	}
}

func (h *draftHandler) setTeams(ctx context.Context, in *SetDraftTeamsInput) (*DraftBoardOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	// Mid-draft the order can still be corrected, but the team set can't:
	// dropping a team cascades its picks away, losing the stage changes they
	// made. A pick already made keeps the team that made it (see
	// store.SlotOwners), so reordering only moves who's up next.
	switch draft.Status {
	case models.DraftComplete:
		return nil, huma.Error409Conflict("a completed draft's order can't be changed")
	case models.DraftActive:
		existing, err := h.store.ListDraftTeams(ctx, in.ID)
		if err != nil {
			return nil, storeErr(err)
		}
		if !sameTeams(existing, in.Body.PreferenceListIDs) {
			return nil, huma.Error409Conflict("teams can't be added or removed once picking has started — only reordered")
		}
	}
	if err := h.store.SetDraftTeams(ctx, in.ID, in.Body.PreferenceListIDs); err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
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

type MakeDraftPickInput struct {
	ID   string `path:"id" doc:"Draft ID"`
	Body struct {
		ApplicationID string `json:"application_id"`
		PickNumber    int    `json:"pick_number,omitempty" doc:"Which slot to fill; omit for the one on the clock" minimum:"0"`
	}
}

type DraftPickOutput struct {
	Body models.DraftPick
}

func (h *draftHandler) pick(ctx context.Context, in *MakeDraftPickInput) (*DraftPickOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID == "" {
		return nil, huma.Error422UnprocessableEntity("application_id is required")
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if draft.Status != models.DraftActive {
		return nil, huma.Error409Conflict("the draft isn't active")
	}
	pick, err := h.store.MakeDraftPick(ctx, draft, in.Body.PickNumber, in.Body.ApplicationID, currentActor(ctx).NUID)
	if err != nil {
		if errors.Is(err, store.ErrDraftSlotTaken) {
			return nil, huma.Error409Conflict("that slot has already been filled")
		}
		return nil, storeErr(err)
	}
	return &DraftPickOutput{Body: pick}, nil
}

type ReplaceDraftPickInput struct {
	ID         string `path:"id" doc:"Draft ID"`
	PickNumber int    `path:"pick_number" doc:"Which slot to change" minimum:"1"`
	Body       struct {
		ApplicationID string `json:"application_id"`
	}
}

func (h *draftHandler) replacePick(ctx context.Context, in *ReplaceDraftPickInput) (*DraftPickOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if in.Body.ApplicationID == "" {
		return nil, huma.Error422UnprocessableEntity("application_id is required")
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if draft.Status == models.DraftSetup {
		return nil, huma.Error409Conflict("the draft hasn't started")
	}
	pick, err := h.store.ReplaceDraftPick(ctx, draft, in.PickNumber, in.Body.ApplicationID, currentActor(ctx).NUID)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrNoChange):
			// Re-picking the applicant already in the slot is a no-op, not a
			// failure — hand back the slot as it stands.
			picks, listErr := h.store.ListDraftPicks(ctx, draft.ID)
			if listErr != nil {
				return nil, storeErr(listErr)
			}
			for _, p := range picks {
				if p.PickNumber == in.PickNumber {
					return &DraftPickOutput{Body: p.DraftPick}, nil
				}
			}
			return nil, huma.Error404NotFound("not found")
		case errors.Is(err, store.ErrDraftAlreadyPicked):
			return nil, huma.Error409Conflict("that applicant is already picked in another slot")
		}
		return nil, storeErr(err)
	}
	return &DraftPickOutput{Body: pick}, nil
}

type RemoveDraftPickInput struct {
	ID         string `path:"id" doc:"Draft ID"`
	PickNumber int    `path:"pick_number" doc:"Which slot to empty" minimum:"1"`
}

func (h *draftHandler) removePick(ctx context.Context, in *RemoveDraftPickInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.RemoveDraftPick(ctx, in.ID, in.PickNumber); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type DraftIDInput struct {
	ID string `path:"id" doc:"Draft ID"`
}

func (h *draftHandler) reset(ctx context.Context, in *DraftIDInput) (*DraftBoardOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.ResetDraft(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	draft, err := h.store.GetDraftByID(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	board, err := h.store.DraftBoard(ctx, draft)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftBoardOutput{Body: board}, nil
}

func (h *draftHandler) delete(ctx context.Context, in *DraftIDInput) (*struct{}, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	if err := h.store.DeleteDraft(ctx, in.ID); err != nil {
		return nil, storeErr(err)
	}
	return nil, nil
}

type DraftedApplicationsOutput struct {
	Body map[string]string
}

func (h *draftHandler) drafted(ctx context.Context, in *CycleScopedInput) (*DraftedApplicationsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	taken, err := h.store.DraftedApplicationIDs(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DraftedApplicationsOutput{Body: taken}, nil
}

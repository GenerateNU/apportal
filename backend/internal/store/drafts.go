package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const draftColumns = `id, cycle_id, application_role, status, rounds, created_by, created_at, updated_at`

// SnakePosition maps a 1-based pick number to a 0-based seat in the order.
// Odd rounds run down the order, even rounds back up it — so the team in the
// last seat picks the end of one round and the start of the next.
func SnakePosition(pickNumber, teamCount int) int {
	if teamCount <= 0 || pickNumber <= 0 {
		return 0
	}
	index := (pickNumber - 1) % teamCount
	if round := (pickNumber-1)/teamCount + 1; round%2 == 0 {
		return teamCount - 1 - index
	}
	return index
}

func (s *Store) GetDraft(ctx context.Context, cycleID string, role models.Role) (models.Draft, error) {
	const q = `SELECT ` + draftColumns + ` FROM drafts WHERE cycle_id = $1 AND application_role = $2`
	rows, err := s.db.Query(ctx, q, cycleID, string(role))
	if err != nil {
		return models.Draft{}, err
	}
	draft, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Draft])
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Draft{}, ErrNotFound
	}
	return draft, err
}

func (s *Store) GetDraftByID(ctx context.Context, id string) (models.Draft, error) {
	const q = `SELECT ` + draftColumns + ` FROM drafts WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Draft{}, err
	}
	draft, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Draft])
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Draft{}, ErrNotFound
	}
	return draft, err
}

// CreateDraft opens the board for a (cycle, role). Idempotent by the table's
// unique constraint — a second call returns the existing one rather than
// erroring, since two chiefs opening the page at once shouldn't race.
func (s *Store) CreateDraft(ctx context.Context, cycleID string, role models.Role, rounds int, createdBy string) (models.Draft, error) {
	const q = `
		INSERT INTO drafts (cycle_id, application_role, rounds, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (cycle_id, application_role) DO NOTHING
		RETURNING ` + draftColumns
	rows, err := s.db.Query(ctx, q, cycleID, string(role), rounds, createdBy)
	if err != nil {
		return models.Draft{}, err
	}
	draft, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Draft])
	if errors.Is(err, pgx.ErrNoRows) {
		return s.GetDraft(ctx, cycleID, role)
	}
	return draft, err
}

type DraftUpdate struct {
	Status *models.DraftStatus
	Rounds *int
}

func (s *Store) UpdateDraft(ctx context.Context, id string, in DraftUpdate) (models.Draft, error) {
	const q = `
		UPDATE drafts SET
			status = COALESCE($2, status),
			rounds = COALESCE($3, rounds)
		WHERE id = $1
		RETURNING ` + draftColumns
	var status *string
	if in.Status != nil {
		v := string(*in.Status)
		status = &v
	}
	rows, err := s.db.Query(ctx, q, id, status, in.Rounds)
	if err != nil {
		return models.Draft{}, err
	}
	draft, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Draft])
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Draft{}, ErrNotFound
	}
	return draft, err
}

// SetDraftTeams replaces the order wholesale: the seats are the given
// preference lists, in the given order. Teams that drop out take their picks
// with them (ON DELETE CASCADE), which is why the handler only allows this
// while the draft is still in setup.
func (s *Store) SetDraftTeams(ctx context.Context, draftID string, preferenceListIDs []string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const clear = `DELETE FROM draft_teams WHERE draft_id = $1 AND NOT (preference_list_id = ANY($2::uuid[]))`
	if _, err := tx.Exec(ctx, clear, draftID, preferenceListIDs); err != nil {
		return err
	}
	const upsert = `
		INSERT INTO draft_teams (draft_id, preference_list_id, position)
		SELECT $1, o.preference_list_id, o.ord - 1
		FROM unnest($2::uuid[]) WITH ORDINALITY AS o(preference_list_id, ord)
		ON CONFLICT (draft_id, preference_list_id) DO UPDATE SET position = EXCLUDED.position`
	if _, err := tx.Exec(ctx, upsert, draftID, preferenceListIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) ListDraftTeams(ctx context.Context, draftID string) ([]models.DraftTeamDetail, error) {
	const q = `
		SELECT t.id, t.draft_id, t.preference_list_id, t.position,
		       pl.name,
		       COALESCE(
		         (SELECT array_agg(u.full_name ORDER BY u.full_name)
		          FROM preference_list_members m
		          JOIN users u ON u.nuid = m.lead_nuid
		          WHERE m.preference_list_id = pl.id),
		         '{}'
		       )
		FROM draft_teams t
		JOIN preference_lists pl ON pl.id = t.preference_list_id
		WHERE t.draft_id = $1
		ORDER BY t.position`
	rows, err := s.db.Query(ctx, q, draftID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.DraftTeamDetail])
}

func (s *Store) ListDraftPicks(ctx context.Context, draftID string) ([]models.DraftPickDetail, error) {
	const q = `
		SELECT p.id, p.draft_id, p.pick_number, p.draft_team_id, p.application_id,
		       p.previous_stage, p.picked_by, p.picked_at,
		       COALESCE(u.full_name, ''), COALESCE(u.email, '')
		FROM draft_picks p
		JOIN applications a ON a.id = p.application_id
		LEFT JOIN users u ON u.nuid = a.user_nuid
		WHERE p.draft_id = $1
		ORDER BY p.pick_number`
	rows, err := s.db.Query(ctx, q, draftID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.DraftPickDetail])
}

// DraftBoard assembles the order, the picks, and which slot is on the clock.
func (s *Store) DraftBoard(ctx context.Context, draft models.Draft) (models.DraftBoard, error) {
	board := models.DraftBoard{Draft: draft}
	teams, err := s.ListDraftTeams(ctx, draft.ID)
	if err != nil {
		return board, err
	}
	picks, err := s.ListDraftPicks(ctx, draft.ID)
	if err != nil {
		return board, err
	}
	board.Teams = teams
	board.Picks = picks
	if draft.Status != models.DraftActive || len(teams) == 0 {
		return board, nil
	}
	slot := nextOpenSlot(pickNumbers(picks), draft.Rounds*len(teams))
	if slot == 0 {
		return board, nil
	}
	board.OnTheClock = slot
	board.OnTheClockTeamID = teams[SnakePosition(slot, len(teams))].ID
	return board, nil
}

// nextOpenSlot is the lowest unfilled pick number, so undoing a pick mid-board
// puts that slot back on the clock instead of the end of the board. 0 when
// every slot is filled.
func nextOpenSlot(taken []int, total int) int {
	filled := make(map[int]bool, len(taken))
	for _, n := range taken {
		filled[n] = true
	}
	for n := 1; n <= total; n++ {
		if !filled[n] {
			return n
		}
	}
	return 0
}

func pickNumbers(picks []models.DraftPickDetail) []int {
	out := make([]int, len(picks))
	for i, p := range picks {
		out[i] = p.PickNumber
	}
	return out
}

// ErrDraftSlotTaken is returned when the requested slot already holds a pick —
// two operators submitting at once, or a stale board.
var ErrDraftSlotTaken = errors.New("draft slot already filled")

// ErrNoChange means the write asked for the state the row is already in.
var ErrNoChange = errors.New("nothing to change")

// MakeDraftPick fills the given slot and moves the applicant to accepted,
// remembering the stage they came from so an undo can put it back. Slot 0
// means "whichever is on the clock".
func (s *Store) MakeDraftPick(ctx context.Context, draft models.Draft, slot int, applicationID, pickedBy string) (models.DraftPick, error) {
	var pick models.DraftPick

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return pick, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Serialize concurrent picks on this draft: without the lock two operators
	// can both read the same open slot and race to fill it.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, draft.ID); err != nil {
		return pick, err
	}

	teams, err := s.ListDraftTeams(ctx, draft.ID)
	if err != nil {
		return pick, err
	}
	if len(teams) == 0 {
		return pick, ErrNotFound
	}
	picks, err := s.ListDraftPicks(ctx, draft.ID)
	if err != nil {
		return pick, err
	}
	total := draft.Rounds * len(teams)
	if slot == 0 {
		slot = nextOpenSlot(pickNumbers(picks), total)
	}
	if slot < 1 || slot > total {
		return pick, ErrNotFound
	}
	for _, p := range picks {
		if p.PickNumber == slot {
			return pick, ErrDraftSlotTaken
		}
	}

	// The applicant has to be in this board's cycle and role, and their stage
	// is captured here so the undo below has somewhere to put them back.
	var previousStage string
	const stageQ = `SELECT stage FROM applications WHERE id = $1 AND cycle_id = $2 AND application_role = $3`
	if err := tx.QueryRow(ctx, stageQ, applicationID, draft.CycleID, string(draft.ApplicationRole)).Scan(&previousStage); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pick, ErrNotFound
		}
		return pick, err
	}

	const insert = `
		INSERT INTO draft_picks (draft_id, pick_number, draft_team_id, application_id, previous_stage, picked_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, draft_id, pick_number, draft_team_id, application_id, previous_stage, picked_by, picked_at`
	teamID := teams[SnakePosition(slot, len(teams))].ID
	rows, err := tx.Query(ctx, insert, draft.ID, slot, teamID, applicationID, previousStage, pickedBy)
	if err != nil {
		return pick, err
	}
	pick, err = pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.DraftPick])
	if err != nil {
		return pick, err
	}

	const accept = `UPDATE applications SET stage = 'accepted' WHERE id = $1`
	if _, err := tx.Exec(ctx, accept, applicationID); err != nil {
		return pick, err
	}
	return pick, tx.Commit(ctx)
}

// ErrDraftAlreadyPicked is returned when the applicant is already claimed in
// another slot on the same board.
var ErrDraftAlreadyPicked = errors.New("applicant already drafted on this board")

// ReplaceDraftPick swaps the applicant in a slot that's already filled — the
// team changed its mind. Done in place rather than as a remove plus a re-pick,
// so the slot never opens: an empty slot mid-board is the one on the clock,
// which would drag the draft backwards while everyone waits.
//
// The outgoing applicant goes back to the stage they were in, and the incoming
// one's stage is captured in its place, so undo still works afterwards.
func (s *Store) ReplaceDraftPick(ctx context.Context, draft models.Draft, pickNumber int, applicationID, pickedBy string) (models.DraftPick, error) {
	var pick models.DraftPick

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return pick, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, draft.ID); err != nil {
		return pick, err
	}

	var oldApplicationID, oldPreviousStage string
	const current = `
		SELECT application_id, previous_stage FROM draft_picks
		WHERE draft_id = $1 AND pick_number = $2 FOR UPDATE`
	if err := tx.QueryRow(ctx, current, draft.ID, pickNumber).Scan(&oldApplicationID, &oldPreviousStage); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pick, ErrNotFound
		}
		return pick, err
	}
	if oldApplicationID == applicationID {
		return pick, ErrNoChange
	}

	// Claimed in another slot on this board — the unique constraint would
	// catch it, but a named conflict tells the operator what actually happened.
	var takenElsewhere bool
	const taken = `
		SELECT EXISTS (SELECT 1 FROM draft_picks
		               WHERE draft_id = $1 AND application_id = $2 AND pick_number <> $3)`
	if err := tx.QueryRow(ctx, taken, draft.ID, applicationID, pickNumber).Scan(&takenElsewhere); err != nil {
		return pick, err
	}
	if takenElsewhere {
		return pick, ErrDraftAlreadyPicked
	}

	var newPreviousStage string
	const stageQ = `SELECT stage FROM applications WHERE id = $1 AND cycle_id = $2 AND application_role = $3`
	if err := tx.QueryRow(ctx, stageQ, applicationID, draft.CycleID, string(draft.ApplicationRole)).Scan(&newPreviousStage); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pick, ErrNotFound
		}
		return pick, err
	}

	// Put the outgoing applicant back before the incoming one is accepted, so
	// a swap between two rows can't leave both in the same stage.
	const restore = `UPDATE applications SET stage = $2 WHERE id = $1 AND stage = 'accepted'`
	if _, err := tx.Exec(ctx, restore, oldApplicationID, oldPreviousStage); err != nil {
		return pick, err
	}

	const update = `
		UPDATE draft_picks
		SET application_id = $3, previous_stage = $4, picked_by = $5, picked_at = NOW()
		WHERE draft_id = $1 AND pick_number = $2
		RETURNING id, draft_id, pick_number, draft_team_id, application_id, previous_stage, picked_by, picked_at`
	rows, err := tx.Query(ctx, update, draft.ID, pickNumber, applicationID, newPreviousStage, pickedBy)
	if err != nil {
		return pick, err
	}
	pick, err = pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.DraftPick])
	if err != nil {
		return pick, err
	}

	const accept = `UPDATE applications SET stage = 'accepted' WHERE id = $1`
	if _, err := tx.Exec(ctx, accept, applicationID); err != nil {
		return pick, err
	}
	return pick, tx.Commit(ctx)
}

// RemoveDraftPick empties a slot and puts the applicant back in the stage they
// were in before it — but only if they're still in accepted, so a stage a
// chief moved deliberately afterwards isn't clobbered.
func (s *Store) RemoveDraftPick(ctx context.Context, draftID string, pickNumber int) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var applicationID, previousStage string
	const del = `
		DELETE FROM draft_picks WHERE draft_id = $1 AND pick_number = $2
		RETURNING application_id, previous_stage`
	if err := tx.QueryRow(ctx, del, draftID, pickNumber).Scan(&applicationID, &previousStage); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	const restore = `UPDATE applications SET stage = $2 WHERE id = $1 AND stage = 'accepted'`
	if _, err := tx.Exec(ctx, restore, applicationID, previousStage); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// restoreDraftedStages puts every applicant a draft claimed back in the stage
// they were in before the pick. Scoped to rows still sitting in accepted, so a
// stage someone moved deliberately after the pick isn't clobbered — the same
// rule RemoveDraftPick follows for one pick.
func restoreDraftedStages(ctx context.Context, tx pgx.Tx, draftID string) error {
	const q = `
		UPDATE applications a SET stage = p.previous_stage
		FROM draft_picks p
		WHERE p.draft_id = $1 AND a.id = p.application_id AND a.stage = 'accepted'`
	_, err := tx.Exec(ctx, q, draftID)
	return err
}

// ResetDraft clears every pick and returns the board to setup, undoing the
// stage changes on the way out. The team order survives, so a rehearsal can be
// wiped without rebuilding it.
func (s *Store) ResetDraft(ctx context.Context, draftID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := restoreDraftedStages(ctx, tx, draftID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM draft_picks WHERE draft_id = $1`, draftID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE drafts SET status = 'setup' WHERE id = $1`, draftID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// DeleteDraft removes the board outright. Picks cascade, so their stage
// changes are undone first — otherwise the applicants would be left in
// accepted with nothing on record explaining why.
func (s *Store) DeleteDraft(ctx context.Context, draftID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := restoreDraftedStages(ctx, tx, draftID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM drafts WHERE id = $1`, draftID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// DraftedApplicationIDs is every application already claimed on any board in
// the cycle, for greying them out on the preference lists people draft from.
func (s *Store) DraftedApplicationIDs(ctx context.Context, cycleID string) (map[string]string, error) {
	const q = `
		SELECT p.application_id, pl.name
		FROM draft_picks p
		JOIN drafts d       ON d.id = p.draft_id
		JOIN draft_teams t  ON t.id = p.draft_team_id
		JOIN preference_lists pl ON pl.id = t.preference_list_id
		WHERE d.cycle_id = $1`
	rows, err := s.db.Query(ctx, q, cycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var applicationID, teamName string
		if err := rows.Scan(&applicationID, &teamName); err != nil {
			return nil, err
		}
		out[applicationID] = teamName
	}
	return out, rows.Err()
}

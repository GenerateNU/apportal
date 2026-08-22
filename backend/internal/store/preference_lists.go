package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListColumns = `id, cycle_id, name, status, created_by, submitted_at, created_at, updated_at, meeting_day`

// PreferenceListCreate carries a new list's initial fields. The creator is
// added as the first member in the same transaction, so "is a member" (not
// "is the creator") stays the one access check every other route needs.
type PreferenceListCreate struct {
	CycleID   string
	Name      string
	CreatedBy string
}

func (s *Store) CreatePreferenceList(ctx context.Context, in PreferenceListCreate) (models.PreferenceList, error) {
	var list models.PreferenceList

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return list, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const insertList = `
		INSERT INTO preference_lists (cycle_id, name, created_by)
		VALUES ($1, $2, $3)
		RETURNING ` + preferenceListColumns
	rows, err := tx.Query(ctx, insertList, in.CycleID, in.Name, in.CreatedBy)
	if err != nil {
		return list, err
	}
	list, err = pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceList])
	if err != nil {
		return list, err
	}

	const insertMember = `INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by) VALUES ($1, $2, $2)`
	if _, err := tx.Exec(ctx, insertMember, list.ID, in.CreatedBy); err != nil {
		return list, err
	}

	if err := tx.Commit(ctx); err != nil {
		return list, err
	}
	return list, nil
}

func (s *Store) GetPreferenceList(ctx context.Context, id string) (models.PreferenceList, error) {
	const q = `SELECT ` + preferenceListColumns + ` FROM preference_lists WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.PreferenceList{}, err
	}
	list, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceList])
	if errors.Is(err, pgx.ErrNoRows) {
		return list, ErrNotFound
	}
	return list, err
}

// GetPreferenceListDetail bundles a list with its members (added_at order),
// shared entries (rank order, joined to the applicant's name/email/role),
// and every member's personal entries (owner then rank order) for a single
// detail-page fetch.
func (s *Store) GetPreferenceListDetail(ctx context.Context, id string) (models.PreferenceListDetail, error) {
	var detail models.PreferenceListDetail

	list, err := s.GetPreferenceList(ctx, id)
	if err != nil {
		return detail, err
	}
	detail.PreferenceList = list

	const membersQ = `SELECT id, preference_list_id, lead_nuid, added_by, added_at FROM preference_list_members WHERE preference_list_id = $1 ORDER BY added_at`
	memberRows, err := s.db.Query(ctx, membersQ, id)
	if err != nil {
		return detail, err
	}
	members, err := pgx.CollectRows(memberRows, pgx.RowToStructByPos[models.PreferenceListMember])
	if err != nil {
		return detail, err
	}
	detail.Members = members

	const entriesQ = `
		SELECT e.id, e.preference_list_id, e.application_id, e.rank, e.reasoning, e.updated_by, e.created_at, e.updated_at,
		       u.full_name, u.email, a.application_role
		FROM preference_list_entries e
		JOIN applications a ON a.id = e.application_id
		JOIN users u ON u.nuid = a.user_nuid
		WHERE e.preference_list_id = $1
		ORDER BY e.rank`
	entryRows, err := s.db.Query(ctx, entriesQ, id)
	if err != nil {
		return detail, err
	}
	entries, err := pgx.CollectRows(entryRows, pgx.RowToStructByPos[models.PreferenceListEntryDetail])
	if err != nil {
		return detail, err
	}
	detail.Entries = entries

	const personalEntriesQ = `
		SELECT pe.id, pe.preference_list_id, pe.owner_nuid, pe.application_id, pe.rank, pe.reasoning, pe.created_at, pe.updated_at,
		       ou.full_name, au.full_name, au.email, a.application_role
		FROM preference_list_personal_entries pe
		JOIN applications a ON a.id = pe.application_id
		JOIN users au ON au.nuid = a.user_nuid
		JOIN users ou ON ou.nuid = pe.owner_nuid
		WHERE pe.preference_list_id = $1
		ORDER BY pe.owner_nuid, pe.rank`
	personalRows, err := s.db.Query(ctx, personalEntriesQ, id)
	if err != nil {
		return detail, err
	}
	personalEntries, err := pgx.CollectRows(personalRows, pgx.RowToStructByPos[models.PreferenceListPersonalEntryDetail])
	if err != nil {
		return detail, err
	}
	detail.PersonalEntries = personalEntries

	return detail, nil
}

// ListPreferenceLists returns every group for a cycle. Chiefs/admins pass
// includeAll=true to see every group; anyone else only sees groups they
// belong to — a group a lead isn't on shouldn't even reveal its name to
// them.
func (s *Store) ListPreferenceLists(ctx context.Context, cycleID string, memberNUID string, includeAll bool) ([]models.PreferenceListSummary, error) {
	const base = `
		SELECT pl.id, pl.cycle_id, pl.name, pl.status, pl.created_by, pl.submitted_at, pl.created_at, pl.updated_at, pl.meeting_day,
		       COUNT(DISTINCT m.id) AS member_count,
		       COUNT(DISTINCT e.id) AS entry_count,
		       COALESCE(array_agg(DISTINCT u.full_name) FILTER (WHERE u.full_name IS NOT NULL), '{}')::text[] AS member_names
		FROM preference_lists pl
		LEFT JOIN preference_list_members m ON m.preference_list_id = pl.id
		LEFT JOIN users u ON u.nuid = m.lead_nuid
		LEFT JOIN preference_list_entries e ON e.preference_list_id = pl.id
		WHERE pl.cycle_id = $1`
	const groupOrder = ` GROUP BY pl.id ORDER BY pl.created_at DESC`

	var rows pgx.Rows
	var err error
	if includeAll {
		rows, err = s.db.Query(ctx, base+groupOrder, cycleID)
	} else {
		const memberFilter = ` AND EXISTS (SELECT 1 FROM preference_list_members m2 WHERE m2.preference_list_id = pl.id AND m2.lead_nuid = $2)`
		rows, err = s.db.Query(ctx, base+memberFilter+groupOrder, cycleID, memberNUID)
	}
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.PreferenceListSummary])
}

// PreferenceListUpdate carries a partial rename/status change. Setting
// Status to submitted stamps submitted_at; setting it back to draft clears
// it — the deadline (not this status) is what actually locks editing.
type PreferenceListUpdate struct {
	Name   *string
	Status *models.PreferenceListStatus
}

func (s *Store) UpdatePreferenceList(ctx context.Context, id string, in PreferenceListUpdate) (models.PreferenceList, error) {
	const q = `
		UPDATE preference_lists SET
			name         = COALESCE($2, name),
			status       = COALESCE($3, status),
			submitted_at = CASE
				WHEN $3::text = 'submitted' THEN NOW()
				WHEN $3::text = 'draft' THEN NULL
				ELSE submitted_at
			END,
			updated_at = NOW()
		WHERE id = $1
		RETURNING ` + preferenceListColumns
	rows, err := s.db.Query(ctx, q, id, in.Name, in.Status)
	if err != nil {
		return models.PreferenceList{}, err
	}
	list, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceList])
	if errors.Is(err, pgx.ErrNoRows) {
		return list, ErrNotFound
	}
	return list, err
}

// UpdatePreferenceListMeetingDay sets or clears (meetingDay == nil) which day
// this list's members have settled on for meeting to go through it —
// separate from UpdatePreferenceList so a plain rename/status change can
// never accidentally clear it (a nil Go value would be ambiguous between
// "leave it" and "clear it" on a shared partial-update endpoint).
func (s *Store) UpdatePreferenceListMeetingDay(ctx context.Context, id string, meetingDay *string) (models.PreferenceList, error) {
	const q = `
		UPDATE preference_lists SET meeting_day = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING ` + preferenceListColumns
	rows, err := s.db.Query(ctx, q, id, meetingDay)
	if err != nil {
		return models.PreferenceList{}, err
	}
	list, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceList])
	if errors.Is(err, pgx.ErrNoRows) {
		return list, ErrNotFound
	}
	return list, err
}

// GetLeadMeetingAvailability resolves each nuid's own selected options from
// the "Meeting Availability" question on their most recent application (as
// an applicant, in whatever cycle they applied) — used to flag who's free
// for a preference list's chosen meeting day when picking new members.
// Every requested nuid gets a row; Options is an empty array when they have
// no application, their application predates that question, or they left it
// blank.
func (s *Store) GetLeadMeetingAvailability(ctx context.Context, nuids []string) ([]models.LeadMeetingAvailability, error) {
	if len(nuids) == 0 {
		return nil, nil
	}
	const q = `
		WITH latest_app AS (
			SELECT DISTINCT ON (user_nuid) id AS application_id, user_nuid, cycle_id, application_role
			FROM applications
			WHERE user_nuid = ANY($1::text[])
			ORDER BY user_nuid, updated_at DESC
		),
		avail_question AS (
			SELECT DISTINCT ON (la.application_id) la.application_id, la.user_nuid, q.id AS question_id
			FROM latest_app la
			JOIN questions q ON q.cycle_id = la.cycle_id
				AND (q.application_role = la.application_role OR q.application_role IS NULL)
				AND q.question_text ILIKE '%availability%'
			ORDER BY la.application_id, q.display_order
		)
		SELECT aq.user_nuid, COALESCE(wa.answer_options, '[]'::jsonb)
		FROM avail_question aq
		LEFT JOIN written_answers wa ON wa.application_id = aq.application_id AND wa.question_id = aq.question_id`
	rows, err := s.db.Query(ctx, q, nuids)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.LeadMeetingAvailability])
}

func (s *Store) DeletePreferenceList(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM preference_lists WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) IsPreferenceListMember(ctx context.Context, listID, nuid string) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM preference_list_members WHERE preference_list_id = $1 AND lead_nuid = $2)`
	var exists bool
	if err := s.db.QueryRow(ctx, q, listID, nuid).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

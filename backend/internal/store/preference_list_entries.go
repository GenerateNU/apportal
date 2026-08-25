package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListEntryColumns = `id, preference_list_id, application_id, rank, reasoning, updated_by, created_at, updated_at`

// PreferenceListEntryUpsert adds an applicant to a list or edits their
// reasoning. Reasoning nil means "leave whatever's there" (same
// COALESCE-preserve contract as RecordingReviewUpsert.Comments) — pass an
// empty string, not nil, to explicitly clear it. Role is the application's
// own role, passed in by the caller (already fetched to validate cycle)
// rather than re-derived here, and used both to scope the rank sequence and
// to key the insert lock below.
type PreferenceListEntryUpsert struct {
	PreferenceListID string
	ApplicationID    string
	Role             models.Role
	Reasoning        *string
	UpdatedBy        string
}

// UpsertPreferenceListEntry adds a new entry at the end of its role's rank
// order, or edits an existing one's reasoning without touching its rank —
// so editing reasoning can never clobber a concurrent reorder. Rank is
// scoped to entries sharing the new application's own role, so each role
// tab gets its own independent 1..N sequence within the same group.
func (s *Store) UpsertPreferenceListEntry(ctx context.Context, in PreferenceListEntryUpsert) (models.PreferenceListEntry, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return models.PreferenceListEntry{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Serializes concurrent inserts for the same (list, role): without this,
	// two members adding different applicants of the same role at nearly the
	// same instant can both read the same MAX(rank) before either commits,
	// producing duplicate ranks. Transaction-scoped — released automatically
	// on commit/rollback — and keyed on (list, role), so it only blocks
	// inserts targeting this exact role tab, not unrelated ones.
	const lockQ = `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`
	if _, err := tx.Exec(ctx, lockQ, in.PreferenceListID, string(in.Role)); err != nil {
		return models.PreferenceListEntry{}, err
	}

	const q = `
		INSERT INTO preference_list_entries (preference_list_id, application_id, rank, reasoning, updated_by)
		VALUES (
			$1, $2,
			(SELECT COALESCE(MAX(e.rank), 0) + 1
			 FROM preference_list_entries e
			 JOIN applications a ON a.id = e.application_id
			 WHERE e.preference_list_id = $1 AND a.application_role = $5),
			$3, $4
		)
		ON CONFLICT (preference_list_id, application_id) DO UPDATE SET
			reasoning  = COALESCE(EXCLUDED.reasoning, preference_list_entries.reasoning),
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING ` + preferenceListEntryColumns
	rows, err := tx.Query(ctx, q, in.PreferenceListID, in.ApplicationID, in.Reasoning, in.UpdatedBy, in.Role)
	if err != nil {
		return models.PreferenceListEntry{}, err
	}
	entry, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListEntry])
	if err != nil {
		return models.PreferenceListEntry{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.PreferenceListEntry{}, err
	}
	return entry, nil
}

func (s *Store) DeletePreferenceListEntry(ctx context.Context, listID, applicationID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM preference_list_entries WHERE preference_list_id = $1 AND application_id = $2`, listID, applicationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListPreferenceListEntryApplicationIDs returns the current entries'
// application ids for one role, for the handler to validate a reorder
// request is an exact permutation of that role's entries (a group's other
// roles' entries are untouched by the same reorder call) before calling
// ReorderPreferenceListEntries.
func (s *Store) ListPreferenceListEntryApplicationIDs(ctx context.Context, listID string, role models.Role) ([]string, error) {
	const q = `
		SELECT e.application_id
		FROM preference_list_entries e
		JOIN applications a ON a.id = e.application_id
		WHERE e.preference_list_id = $1 AND a.application_role = $2`
	rows, err := s.db.Query(ctx, q, listID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// ReorderPreferenceListEntries rewrites rank for every entry in listID to
// match the given order (index 0 -> rank 1, etc.) in one statement.
func (s *Store) ReorderPreferenceListEntries(ctx context.Context, listID string, orderedApplicationIDs []string) error {
	const q = `
		UPDATE preference_list_entries e SET rank = o.ord, updated_at = NOW()
		FROM unnest($2::uuid[]) WITH ORDINALITY AS o(application_id, ord)
		WHERE e.preference_list_id = $1 AND e.application_id = o.application_id`
	_, err := s.db.Exec(ctx, q, listID, orderedApplicationIDs)
	return err
}

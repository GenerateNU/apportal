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
// empty string, not nil, to explicitly clear it.
type PreferenceListEntryUpsert struct {
	PreferenceListID string
	ApplicationID    string
	Reasoning        *string
	UpdatedBy        string
}

// UpsertPreferenceListEntry adds a new entry at the end of the rank order, or
// edits an existing one's reasoning without touching its rank — so editing
// reasoning can never clobber a concurrent reorder.
func (s *Store) UpsertPreferenceListEntry(ctx context.Context, in PreferenceListEntryUpsert) (models.PreferenceListEntry, error) {
	const q = `
		INSERT INTO preference_list_entries (preference_list_id, application_id, rank, reasoning, updated_by)
		VALUES ($1, $2, (SELECT COALESCE(MAX(rank), 0) + 1 FROM preference_list_entries WHERE preference_list_id = $1), $3, $4)
		ON CONFLICT (preference_list_id, application_id) DO UPDATE SET
			reasoning  = COALESCE(EXCLUDED.reasoning, preference_list_entries.reasoning),
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING ` + preferenceListEntryColumns
	rows, err := s.db.Query(ctx, q, in.PreferenceListID, in.ApplicationID, in.Reasoning, in.UpdatedBy)
	if err != nil {
		return models.PreferenceListEntry{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListEntry])
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
// application ids, for the handler to validate a reorder request is an
// exact permutation of them before calling ReorderPreferenceListEntries.
func (s *Store) ListPreferenceListEntryApplicationIDs(ctx context.Context, listID string) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT application_id FROM preference_list_entries WHERE preference_list_id = $1`, listID)
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

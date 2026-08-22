package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListPersonalEntryColumns = `id, preference_list_id, owner_nuid, application_id, rank, reasoning, created_at, updated_at`

// PreferenceListPersonalEntryUpsert adds an applicant to a lead's own
// personal list within a group, or edits their reasoning. Reasoning nil
// means "leave whatever's there" — same COALESCE-preserve contract as
// PreferenceListEntryUpsert.
type PreferenceListPersonalEntryUpsert struct {
	PreferenceListID string
	OwnerNUID        string
	ApplicationID    string
	Reasoning        *string
}

// UpsertPersonalPreferenceListEntry mirrors UpsertPreferenceListEntry, but
// scoped to one owner's personal list within the group: rank is a separate
// 1..N sequence per (list, owner, role), independent of the shared list's
// ranks and every other owner's.
func (s *Store) UpsertPersonalPreferenceListEntry(ctx context.Context, in PreferenceListPersonalEntryUpsert) (models.PreferenceListPersonalEntry, error) {
	const q = `
		INSERT INTO preference_list_personal_entries (preference_list_id, owner_nuid, application_id, rank, reasoning)
		VALUES (
			$1, $2, $3,
			(SELECT COALESCE(MAX(pe.rank), 0) + 1
			 FROM preference_list_personal_entries pe
			 JOIN applications a ON a.id = pe.application_id
			 WHERE pe.preference_list_id = $1 AND pe.owner_nuid = $2
			   AND a.application_role = (SELECT application_role FROM applications WHERE id = $3)),
			$4
		)
		ON CONFLICT (preference_list_id, owner_nuid, application_id) DO UPDATE SET
			reasoning  = COALESCE(EXCLUDED.reasoning, preference_list_personal_entries.reasoning),
			updated_at = NOW()
		RETURNING ` + preferenceListPersonalEntryColumns
	rows, err := s.db.Query(ctx, q, in.PreferenceListID, in.OwnerNUID, in.ApplicationID, in.Reasoning)
	if err != nil {
		return models.PreferenceListPersonalEntry{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListPersonalEntry])
}

func (s *Store) DeletePersonalPreferenceListEntry(ctx context.Context, listID, ownerNUID, applicationID string) error {
	const q = `DELETE FROM preference_list_personal_entries WHERE preference_list_id = $1 AND owner_nuid = $2 AND application_id = $3`
	tag, err := s.db.Exec(ctx, q, listID, ownerNUID, applicationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListPersonalPreferenceListEntryApplicationIDs returns one owner's current
// personal-entry application ids for one role, for the handler to validate a
// reorder request the same way ListPreferenceListEntryApplicationIDs does
// for the shared list.
func (s *Store) ListPersonalPreferenceListEntryApplicationIDs(ctx context.Context, listID, ownerNUID string, role models.Role) ([]string, error) {
	const q = `
		SELECT pe.application_id
		FROM preference_list_personal_entries pe
		JOIN applications a ON a.id = pe.application_id
		WHERE pe.preference_list_id = $1 AND pe.owner_nuid = $2 AND a.application_role = $3`
	rows, err := s.db.Query(ctx, q, listID, ownerNUID, role)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// ReorderPersonalPreferenceListEntries mirrors ReorderPreferenceListEntries,
// scoped to one owner's own personal entries.
func (s *Store) ReorderPersonalPreferenceListEntries(ctx context.Context, listID, ownerNUID string, orderedApplicationIDs []string) error {
	const q = `
		UPDATE preference_list_personal_entries pe SET rank = o.ord, updated_at = NOW()
		FROM unnest($3::uuid[]) WITH ORDINALITY AS o(application_id, ord)
		WHERE pe.preference_list_id = $1 AND pe.owner_nuid = $2 AND pe.application_id = o.application_id`
	_, err := s.db.Exec(ctx, q, listID, ownerNUID, orderedApplicationIDs)
	return err
}

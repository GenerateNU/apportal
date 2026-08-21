package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListMemberColumns = `id, preference_list_id, lead_nuid, added_by, added_at`

// AddPreferenceListMember adds a lead as a collaborator on a list. Any
// current member (or a chief) may call this — mirrors
// CreateInterviewReviewAssignment's plain-insert-with-conflict-mapping shape.
func (s *Store) AddPreferenceListMember(ctx context.Context, listID, leadNUID, addedBy string) (models.PreferenceListMember, error) {
	const q = `
		INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by)
		VALUES ($1, $2, $3)
		RETURNING ` + preferenceListMemberColumns
	rows, err := s.db.Query(ctx, q, listID, leadNUID, addedBy)
	if err != nil {
		return models.PreferenceListMember{}, err
	}
	m, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListMember])
	if uniqueViolation(err) {
		return m, ErrConflict
	}
	return m, err
}

// RemovePreferenceListMember scopes the delete to (id, preference_list_id) so
// a member id from one list can't be used to remove a row on another list.
func (s *Store) RemovePreferenceListMember(ctx context.Context, listID, memberID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM preference_list_members WHERE id = $1 AND preference_list_id = $2`, memberID, listID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

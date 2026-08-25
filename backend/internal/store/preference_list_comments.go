package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const preferenceListCommentColumns = `id, preference_list_id, application_id, author_nuid, body, created_at, updated_at`

// CreatePreferenceListComment adds a comment. applicationID nil posts a
// comment on the group as a whole; set posts on that one applicant/entry.
// Any group member may leave any number of these.
func (s *Store) CreatePreferenceListComment(ctx context.Context, listID string, applicationID *string, authorNUID, body string) (models.PreferenceListCommentDetail, error) {
	var detail models.PreferenceListCommentDetail
	const q = `
		INSERT INTO preference_list_comments (preference_list_id, application_id, author_nuid, body)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + preferenceListCommentColumns
	rows, err := s.db.Query(ctx, q, listID, applicationID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListComment])
	if err != nil {
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{comment.AuthorNUID})
	if err != nil {
		return detail, err
	}
	detail.PreferenceListComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// UpdatePreferenceListComment edits a comment's body. Scoped to both listID
// and authorNUID — listID so a comment id from one list can't be reached
// through a different list's URL (mirrors RemovePreferenceListMember's
// (id, preference_list_id) scoping), authorNUID so a lead can only edit
// their own comments. ErrNotFound covers "doesn't exist", "isn't yours", and
// "isn't in this list" alike, without distinguishing them to the caller.
func (s *Store) UpdatePreferenceListComment(ctx context.Context, listID, commentID, authorNUID, body string) (models.PreferenceListCommentDetail, error) {
	var detail models.PreferenceListCommentDetail
	const q = `
		UPDATE preference_list_comments SET body = $4, updated_at = NOW()
		WHERE id = $1 AND preference_list_id = $2 AND author_nuid = $3
		RETURNING ` + preferenceListCommentColumns
	rows, err := s.db.Query(ctx, q, commentID, listID, authorNUID, body)
	if err != nil {
		return detail, err
	}
	comment, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.PreferenceListComment])
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return detail, ErrNotFound
		}
		return detail, err
	}
	names, err := s.namesByNUIDs(ctx, []string{comment.AuthorNUID})
	if err != nil {
		return detail, err
	}
	detail.PreferenceListComment = comment
	detail.AuthorName = names[comment.AuthorNUID]
	return detail, nil
}

// ListPreferenceListComments returns every comment on a list — both
// group-level (application_id NULL) and per-entry — oldest first, for
// GetPreferenceListDetail to bundle in one fetch.
func (s *Store) ListPreferenceListComments(ctx context.Context, listID string) ([]models.PreferenceListCommentDetail, error) {
	const q = `SELECT ` + preferenceListCommentColumns + ` FROM preference_list_comments WHERE preference_list_id = $1 ORDER BY created_at`
	rows, err := s.db.Query(ctx, q, listID)
	if err != nil {
		return nil, err
	}
	comments, err := pgx.CollectRows(rows, pgx.RowToStructByPos[models.PreferenceListComment])
	if err != nil {
		return nil, err
	}

	nuids := make([]string, len(comments))
	for i, c := range comments {
		nuids[i] = c.AuthorNUID
	}
	names, err := s.namesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}

	details := make([]models.PreferenceListCommentDetail, len(comments))
	for i, c := range comments {
		details[i].PreferenceListComment = c
		details[i].AuthorName = names[c.AuthorNUID]
	}
	return details, nil
}

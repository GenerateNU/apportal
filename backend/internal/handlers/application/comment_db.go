package application

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type CommentDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewCommentDB(db *gorm.DB) *CommentDB {
	return &CommentDB{db: db, users: user.NewUserDB(db)}
}

func (c *CommentDB) Create(ctx context.Context, applicationID, authorNUID, body string) (models.ApplicationCommentDetail, error) {
	comment := models.ApplicationComment{ApplicationID: applicationID, AuthorNUID: authorNUID, Body: body}
	if err := utils.Insert(c.db.WithContext(ctx), &comment, "application_id", "author_nuid", "body"); err != nil {
		return models.ApplicationCommentDetail{}, err
	}
	return c.withNames(ctx, comment)
}

func (c *CommentDB) Update(ctx context.Context, applicationID, commentID, authorNUID, body string) (models.ApplicationCommentDetail, error) {
	comment, err := utils.UpdateReturning[models.ApplicationComment](c.db.WithContext(ctx),
		map[string]any{"body": body, "updated_at": gorm.Expr("NOW()")},
		"id = ? AND application_id = ? AND author_nuid = ?", commentID, applicationID, authorNUID)
	if err != nil {
		return models.ApplicationCommentDetail{}, err
	}
	return c.withNames(ctx, comment)
}

func (c *CommentDB) withNames(ctx context.Context, comment models.ApplicationComment) (models.ApplicationCommentDetail, error) {
	names, err := c.users.NamesByNUIDs(ctx, []string{comment.AuthorNUID})
	return models.ApplicationCommentDetail{ApplicationComment: comment, AuthorName: names[comment.AuthorNUID]}, err
}

func (c *CommentDB) List(ctx context.Context, applicationIDs []string) ([]models.ApplicationCommentDetail, error) {
	details := []models.ApplicationCommentDetail{}
	if len(applicationIDs) == 0 {
		return details, nil
	}
	var comments []models.ApplicationComment
	err := c.db.WithContext(ctx).Where("application_id IN ?", applicationIDs).
		Order("application_id").Order("created_at").Order("id").Find(&comments).Error
	if err != nil {
		return nil, err
	}
	nuids := make([]string, len(comments))
	for n, cm := range comments {
		nuids[n] = cm.AuthorNUID
	}
	names, err := c.users.NamesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}
	for _, cm := range comments {
		details = append(details, models.ApplicationCommentDetail{ApplicationComment: cm, AuthorName: names[cm.AuthorNUID]})
	}
	return details, nil
}

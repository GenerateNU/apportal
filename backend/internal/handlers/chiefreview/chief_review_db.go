package chiefreview

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ChiefReviewDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewChiefReviewDB(db *gorm.DB) *ChiefReviewDB {
	return &ChiefReviewDB{db: db, users: user.NewUserDB(db)}
}

// ChiefReviewUpsert carries a chief's vote on an application.
type ChiefReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Vote          *models.ChiefVote // non-nil marks the vote as cast (stamps decided_at)
}

// UpsertChiefReview upserts the chief's vote, keyed on application + reviewer,
// stamping decided_at whenever a vote is given.
func (c *ChiefReviewDB) UpsertChiefReview(ctx context.Context, in ChiefReviewUpsert) (models.ChiefReviewDetail, error) {
	var detail models.ChiefReviewDetail
	review := models.ChiefReview{ApplicationID: in.ApplicationID, ReviewerNUID: in.ReviewerNUID, Vote: in.Vote}
	err := c.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Select("application_id", "reviewer_nuid", "vote").
			Clauses(
				clause.OnConflict{
					Columns: []clause.Column{{Name: "application_id"}, {Name: "reviewer_nuid"}},
					DoUpdates: append(
						clause.AssignmentColumns([]string{"vote"}),
						clause.Assignment{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
					),
				},
				clause.Returning{},
			).
			Create(&review).Error
		if err != nil || in.Vote == nil {
			return err
		}
		return tx.Model(&review).Clauses(clause.Returning{}).UpdateColumn("decided_at", gorm.Expr("NOW()")).Error
	})
	if err != nil {
		return detail, err
	}
	names, err := c.users.NamesByNUIDs(ctx, []string{review.ReviewerNUID})
	if err != nil {
		return detail, err
	}
	detail.ChiefReview = review
	detail.ReviewerName = names[review.ReviewerNUID]
	return detail, nil
}

// ListChiefReviewsForApplications is the batch form of ListChiefReviews, for
// pages of applications.
func (c *ChiefReviewDB) ListChiefReviewsForApplications(ctx context.Context, applicationIDs []string) ([]models.ChiefReviewDetail, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	var reviews []models.ChiefReview
	err := c.db.WithContext(ctx).Where("application_id IN ?", applicationIDs).
		Order("application_id").Order("created_at").Find(&reviews).Error
	if err != nil {
		return nil, err
	}
	return c.withReviewerNames(ctx, reviews)
}

func (c *ChiefReviewDB) ListChiefReviews(ctx context.Context, applicationID string) ([]models.ChiefReviewDetail, error) {
	var reviews []models.ChiefReview
	err := c.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("created_at").Find(&reviews).Error
	if err != nil {
		return nil, err
	}
	return c.withReviewerNames(ctx, reviews)
}

func (c *ChiefReviewDB) withReviewerNames(ctx context.Context, reviews []models.ChiefReview) ([]models.ChiefReviewDetail, error) {
	nuids := make([]string, len(reviews))
	for i, r := range reviews {
		nuids[i] = r.ReviewerNUID
	}
	names, err := c.users.NamesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}
	details := make([]models.ChiefReviewDetail, len(reviews))
	for i, r := range reviews {
		details[i].ChiefReview = r
		details[i].ReviewerName = names[r.ReviewerNUID]
	}
	return details, nil
}

// CreateChiefReviewComment adds a comment; unlike votes, a chief may leave
// any number of these.
func (c *ChiefReviewDB) CreateChiefReviewComment(ctx context.Context, applicationID, authorNUID, body string) (models.ChiefReviewCommentDetail, error) {
	comment := models.ChiefReviewComment{ApplicationID: applicationID, AuthorNUID: authorNUID, Body: body}
	if err := utils.Insert(c.db.WithContext(ctx), &comment, "application_id", "author_nuid", "body"); err != nil {
		return models.ChiefReviewCommentDetail{}, err
	}
	return c.commentDetail(ctx, comment)
}

// UpdateChiefReviewComment edits the author's own comment. ErrNotFound covers
// both "doesn't exist" and "isn't yours".
func (c *ChiefReviewDB) UpdateChiefReviewComment(ctx context.Context, commentID, authorNUID, body string) (models.ChiefReviewCommentDetail, error) {
	comment, err := utils.UpdateReturning[models.ChiefReviewComment](c.db.WithContext(ctx),
		map[string]any{"body": body, "updated_at": gorm.Expr("NOW()")}, "id = ? AND author_nuid = ?", commentID, authorNUID)
	if err != nil {
		return models.ChiefReviewCommentDetail{}, err
	}
	return c.commentDetail(ctx, comment)
}

func (c *ChiefReviewDB) commentDetail(ctx context.Context, comment models.ChiefReviewComment) (models.ChiefReviewCommentDetail, error) {
	names, err := c.users.NamesByNUIDs(ctx, []string{comment.AuthorNUID})
	return models.ChiefReviewCommentDetail{ChiefReviewComment: comment, AuthorName: names[comment.AuthorNUID]}, err
}

// ListChiefReviewComments returns an application's comments, oldest first.
func (c *ChiefReviewDB) ListChiefReviewComments(ctx context.Context, applicationID string) ([]models.ChiefReviewCommentDetail, error) {
	var comments []models.ChiefReviewComment
	err := c.db.WithContext(ctx).Where("application_id = ?", applicationID).Order("created_at").Find(&comments).Error
	if err != nil {
		return nil, err
	}
	nuids := make([]string, len(comments))
	for i, cm := range comments {
		nuids[i] = cm.AuthorNUID
	}
	names, err := c.users.NamesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}
	details := make([]models.ChiefReviewCommentDetail, len(comments))
	for i, cm := range comments {
		details[i] = models.ChiefReviewCommentDetail{ChiefReviewComment: cm, AuthorName: names[cm.AuthorNUID]}
	}
	return details, nil
}

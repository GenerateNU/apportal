package comment

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

func Route(api huma.API, db *gorm.DB) {
	registerComment(api, &commentService{access: access.NewChecker(db), commentDB: NewCommentDB(db)})
}

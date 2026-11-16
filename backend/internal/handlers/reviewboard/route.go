package reviewboard

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

func Route(api huma.API, db *gorm.DB) {
	registerReviewAssignment(api, &reviewService{gate: access.NewChecker(db), store: NewReviewDB(db), staff: staffing.NewService(db)})
}

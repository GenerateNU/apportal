package challenge

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ChallengeDB struct {
	db *gorm.DB
}

func NewChallengeDB(db *gorm.DB) *ChallengeDB {
	return &ChallengeDB{db: db}
}

type ChallengeCreate struct {
	CycleID      string
	Role         models.Role
	Name         string
	ChallengeURL *string
	Instructions *string
	DueAt        *time.Time
}

func (c *ChallengeDB) CreateChallenge(ctx context.Context, in ChallengeCreate) (models.CodeChallenge, error) {
	challenge := models.CodeChallenge{
		CycleID:      in.CycleID,
		Role:         in.Role,
		Name:         in.Name,
		ChallengeURL: in.ChallengeURL,
		Instructions: in.Instructions,
		DueAt:        in.DueAt,
	}
	err := utils.Insert(c.db.WithContext(ctx), &challenge,
		"cycle_id", "application_role", "name", "challenge_url", "instructions", "due_at")
	return challenge, err
}

// ListChallenges returns a cycle's challenges, optionally filtered to one role.
func (c *ChallengeDB) ListChallenges(ctx context.Context, cycleID string, role *models.Role) ([]models.CodeChallenge, error) {
	q := c.db.WithContext(ctx).Where("cycle_id = ?", cycleID)
	if role != nil {
		q = q.Where("application_role = ?", *role)
	}
	challenges := []models.CodeChallenge{}
	return challenges, q.Order("created_at").Find(&challenges).Error
}

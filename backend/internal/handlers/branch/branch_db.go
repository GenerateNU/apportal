package branch

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type BranchDB struct {
	db *gorm.DB
}

func NewBranchDB(db *gorm.DB) *BranchDB {
	return &BranchDB{db: db}
}

func (b *BranchDB) CreateBranch(ctx context.Context, name string) (models.Branch, error) {
	branch := models.Branch{Name: name}
	err := utils.Insert(b.db.WithContext(ctx), &branch, "name")
	return branch, err
}

func (b *BranchDB) ListBranches(ctx context.Context) ([]models.Branch, error) {
	branches := []models.Branch{}
	return branches, b.db.WithContext(ctx).Order("name").Find(&branches).Error
}

func (b *BranchDB) GetBranch(ctx context.Context, id string) (models.Branch, error) {
	var branch models.Branch
	err := b.db.WithContext(ctx).Where("id = ?", id).Take(&branch).Error
	return branch, utils.DBErr(err)
}

func (b *BranchDB) UpdateBranch(ctx context.Context, id string, in BranchUpdate) (models.Branch, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "name", in.Name)
	return utils.UpdateReturning[models.Branch](b.db.WithContext(ctx), updates, "id = ?", id)
}

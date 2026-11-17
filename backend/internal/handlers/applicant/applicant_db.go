package applicant

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ApplicantDB struct {
	db *gorm.DB
}

func NewApplicantDB(db *gorm.DB) *ApplicantDB {
	return &ApplicantDB{db: db}
}

var applicantProfileColumns = []string{"full_name", "github_username", "graduation_year", "major"}

// CreateApplicant inserts a new users row; created is false when the NUID is taken.
func (a *ApplicantDB) CreateApplicant(ctx context.Context, in ApplicantUpsert) (applicant models.Applicant, created bool, err error) {
	applicant = models.Applicant{
		NUID:           in.NUID,
		Email:          in.Email,
		FullName:       in.FullName,
		GithubUsername: in.GithubUsername,
		GraduationYear: in.GraduationYear,
		Major:          in.Major,
	}
	res := a.db.WithContext(ctx).
		Select(append([]string{"nuid", "email"}, applicantProfileColumns...)).
		Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "nuid"}}, DoNothing: true}, clause.Returning{}).
		Create(&applicant)
	return applicant, res.RowsAffected > 0, utils.DBErr(res.Error)
}

// UpdateProfile changes a user's own profile fields, never their email or roles.
func (a *ApplicantDB) UpdateProfile(ctx context.Context, in ApplicantUpsert) (models.Applicant, error) {
	return utils.UpdateReturning[models.Applicant](a.db.WithContext(ctx), map[string]any{
		"full_name":       in.FullName,
		"github_username": in.GithubUsername,
		"graduation_year": in.GraduationYear,
		"major":           in.Major,
	}, "nuid = ?", in.NUID)
}

func (a *ApplicantDB) GetApplicant(ctx context.Context, nuid string) (models.Applicant, error) {
	var applicant models.Applicant
	err := a.db.WithContext(ctx).Where("nuid = ?", nuid).Take(&applicant).Error
	return applicant, utils.DBErr(err)
}

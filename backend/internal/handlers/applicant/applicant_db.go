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

type ApplicantUpsert struct {
	NUID           string
	Email          string
	FullName       string
	GithubUsername *string
	GraduationYear *int
	Major          *string
}

var applicantProfileColumns = []string{"email", "full_name", "github_username", "graduation_year", "major"}

// UpsertApplicant inserts or updates the applicant keyed by NUID. Roles are
// left to the users default on insert and untouched on update; an email owned
// by a different NUID is a conflict.
func (a *ApplicantDB) UpsertApplicant(ctx context.Context, in ApplicantUpsert) (models.Applicant, error) {
	applicant := models.Applicant{
		NUID:           in.NUID,
		Email:          in.Email,
		FullName:       in.FullName,
		GithubUsername: in.GithubUsername,
		GraduationYear: in.GraduationYear,
		Major:          in.Major,
	}
	err := a.db.WithContext(ctx).
		Select(append([]string{"nuid"}, applicantProfileColumns...)).
		Clauses(
			clause.OnConflict{
				Columns:   []clause.Column{{Name: "nuid"}},
				DoUpdates: clause.AssignmentColumns(applicantProfileColumns),
			},
			clause.Returning{},
		).
		Create(&applicant).Error
	return applicant, utils.DBErr(err)
}

func (a *ApplicantDB) GetApplicant(ctx context.Context, nuid string) (models.Applicant, error) {
	var applicant models.Applicant
	err := a.db.WithContext(ctx).Where("nuid = ?", nuid).Take(&applicant).Error
	return applicant, utils.DBErr(err)
}

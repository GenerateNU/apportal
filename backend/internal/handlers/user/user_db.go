package user

import (
	"context"
	"reflect"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type UserDB struct {
	db *gorm.DB
}

func NewUserDB(db *gorm.DB) *UserDB {
	return &UserDB{db: db}
}

func (u *UserDB) CreateUser(ctx context.Context, in UserCreate) (models.User, error) {
	roles := in.Roles
	if roles == nil {
		roles = []models.UserRole{models.UserRoleApplicant}
	}
	user := models.User{
		NUID:           in.NUID,
		Email:          in.Email,
		FullName:       in.FullName,
		Roles:          roles,
		GraduationYear: in.GraduationYear,
		Major:          in.Major,
		GithubUsername: in.GithubUsername,
	}
	err := utils.Insert(u.db.WithContext(ctx), &user,
		"nuid", "email", "full_name", "roles", "graduation_year", "major", "github_username")
	return user, err
}

// ListUsers returns users, optionally filtered to those holding a role. A nil
// limit returns every match (the lead dropdown needs them all); otherwise one
// extra row is fetched to report whether more pages remain.
func (u *UserDB) ListUsers(ctx context.Context, role *models.UserRole, limit *int, offset int) ([]models.User, bool, error) {
	q := u.db.WithContext(ctx).Order("full_name")
	if role != nil {
		q = q.Where("? = ANY(roles)", string(*role))
	}
	if limit != nil {
		q = q.Limit(*limit + 1).Offset(offset)
	}
	users := []models.User{}
	if err := q.Find(&users).Error; err != nil {
		return nil, false, err
	}

	hasMore := false
	if limit != nil && len(users) > *limit {
		users = users[:*limit]
		hasMore = true
	}
	return users, hasMore, nil
}

func (u *UserDB) GetUser(ctx context.Context, nuid string) (models.User, error) {
	var user models.User
	err := u.db.WithContext(ctx).Where("nuid = ?", nuid).Take(&user).Error
	return user, utils.DBErr(err)
}

// GetUserByEmail backs the "current user" lookup, since Supabase sessions
// carry an email, not a NUID.
func (u *UserDB) GetUserByEmail(ctx context.Context, email string) (models.User, error) {
	var user models.User
	err := u.db.WithContext(ctx).Where("email = ?", email).Take(&user).Error
	return user, utils.DBErr(err)
}

func (u *UserDB) UpdateUser(ctx context.Context, nuid string, in UserUpdate) (models.User, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "email", in.Email)
	utils.SetIf(updates, "full_name", in.FullName)
	utils.SetIf(updates, "graduation_year", in.GraduationYear)
	utils.SetIf(updates, "major", in.Major)
	utils.SetIf(updates, "github_username", in.GithubUsername)
	utils.SetIf(updates, "returner", in.Returner)
	if in.Roles != nil {
		// Map updates skip the field serializer, so encode the array here.
		roles, err := models.ArrayLiteral(reflect.ValueOf(in.Roles))
		if err != nil {
			return models.User{}, err
		}
		updates["roles"] = roles
	}

	return utils.UpdateReturning[models.User](u.db.WithContext(ctx), updates, "nuid = ?", nuid)
}

// NamesByNUIDs batch-resolves nuid -> full_name, so listings can show reviewer
// names without opening the chief-only user directory.
func (u *UserDB) NamesByNUIDs(ctx context.Context, nuids []string) (map[string]string, error) {
	names := map[string]string{}
	if len(nuids) == 0 {
		return names, nil
	}
	var rows []struct {
		NUID     string
		FullName string
	}
	err := u.db.WithContext(ctx).Model(&models.User{}).Select("nuid", "full_name").
		Where("nuid IN ?", nuids).Scan(&rows).Error
	for _, r := range rows {
		names[r.NUID] = r.FullName
	}
	return names, err
}

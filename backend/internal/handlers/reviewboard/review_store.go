package reviewboard

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type cycleGate interface {
	CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error
}

type reviewStore interface {
	RoleIDs(ctx context.Context, cycleID string) ([]string, error)
	Staff(ctx context.Context, cycleID string) ([]models.CycleStaffMember, error)
	Applications(ctx context.Context, cycleID string, stages []models.ApplicationStage) ([]models.ApplicationSummary, error)
	Reviewers(ctx context.Context, cycleID string, stages []models.ApplicationStage) ([]assignedReviewer, error)
	SaveAssignments(ctx context.Context, pairs []assign.Pair, assignedBy string) (int, error)
	Locked(ctx context.Context, cycleID string, fn func(reviewStore) error) error

	Blocked(ctx context.Context, cycleID string) (staffing.Blocked, error)
}

type assignedReviewer struct {
	ID            string
	ApplicationID string
	LeadNUID      string
	FullName      string
	Submitted     bool
	Started       bool
}

type ReviewDB struct {
	db        *gorm.DB
	conflicts *staffing.ConflictStore
}

func NewReviewDB(db *gorm.DB) *ReviewDB {
	return &ReviewDB{db: db, conflicts: staffing.NewConflictStore(db)}
}

func (r *ReviewDB) RoleIDs(ctx context.Context, cycleID string) ([]string, error) {
	ids := []string{}
	err := r.db.WithContext(ctx).Model(&models.Role{}).Where("cycle_id = ?", cycleID).Order("name").Pluck("id", &ids).Error
	return ids, err
}

// Staff is the review pool; admins on a chief cycle show as chiefs.
func (r *ReviewDB) Staff(ctx context.Context, cycleID string) ([]models.CycleStaffMember, error) {
	rows := []models.CycleStaffMember{}
	db := r.db.WithContext(ctx)
	err := db.Table("(?) AS p", workflow.StaffPool(db, cycleID)).
		Select("p.user_nuid, u.full_name, u.email, COALESCE(cs.role, 'chief') AS role, COALESCE(cs.created_at, u.created_at) AS created_at").
		Joins("JOIN users u ON u.nuid = p.user_nuid").
		Joins("LEFT JOIN cycle_staff cs ON cs.cycle_id = ? AND cs.user_nuid = p.user_nuid", cycleID).
		Order("role DESC").Order("u.full_name").
		Scan(&rows).Error
	return rows, err
}

func (r *ReviewDB) Applications(ctx context.Context, cycleID string, stages []models.ApplicationStage) ([]models.ApplicationSummary, error) {
	return application.NewApplicationDB(r.db).ListApplications(ctx, application.ApplicationFilter{CycleID: cycleID, Stages: stages})
}

func (r *ReviewDB) Reviewers(ctx context.Context, cycleID string, stages []models.ApplicationStage) ([]assignedReviewer, error) {
	rows := []assignedReviewer{}
	err := reviewersQuery(r.db.WithContext(ctx), cycleID, stages).Scan(&rows).Error
	return rows, err
}

func reviewersQuery(db *gorm.DB, cycleID string, stages []models.ApplicationStage) *gorm.DB {
	return db.Table("lead_assignments la").
		Select(`la.id, la.application_id, la.lead_nuid, COALESCE(u.full_name, la.lead_nuid) AS full_name,
			wr.submitted_at IS NOT NULL AS submitted, wr.id IS NOT NULL AS started`).
		Joins("JOIN applications a ON a.id = la.application_id").
		Joins("LEFT JOIN users u ON u.nuid = la.lead_nuid").
		Joins("LEFT JOIN written_reviews wr ON wr.application_id = la.application_id AND wr.reviewer_nuid = la.lead_nuid").
		Where("a.cycle_id = ?", cycleID).
		Scopes(func(q *gorm.DB) *gorm.DB {
			if len(stages) == 0 {
				return q
			}
			return q.Where("a.stage IN ?", stages)
		}).
		Order("la.assigned_at").Order("la.id")
}

func (r *ReviewDB) SaveAssignments(ctx context.Context, pairs []assign.Pair, assignedBy string) (int, error) {
	rows := make([]leadassignment.LeadAssignmentPair, len(pairs))
	for i, p := range pairs {
		rows[i] = leadassignment.LeadAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
	}
	return leadassignment.NewLeadAssignmentDB(r.db).CreateLeadAssignments(ctx, rows, assignedBy)
}

func (r *ReviewDB) Locked(ctx context.Context, cycleID string, fn func(reviewStore) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := workflow.HoldCycle(tx, cycleID); err != nil {
			return err
		}
		return fn(NewReviewDB(tx))
	})
}

func (r *ReviewDB) Blocked(ctx context.Context, cycleID string) (staffing.Blocked, error) {
	return r.conflicts.Blocked(ctx, cycleID)
}

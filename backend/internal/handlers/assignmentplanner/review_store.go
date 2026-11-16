package assignmentplanner

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/handlers/cyclestaff"
	"github.com/GenerateNU/apportal/backend/internal/handlers/leadassignment"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/reviewrules"
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

	ListConflicts(ctx context.Context, cycleID string) ([]reviewrules.Conflict, error)
	PutConflict(ctx context.Context, cycleID, leadNUID, applicantNUID string) error
	DeleteConflict(ctx context.Context, cycleID, leadNUID, applicantNUID string) error
	IsStaff(ctx context.Context, cycleID, nuid string) (bool, error)
	HasApplicant(ctx context.Context, cycleID, nuid string) (bool, error)
	Blocked(ctx context.Context, cycleID string) (reviewrules.Blocked, error)
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
	conflicts *reviewrules.Conflicts
}

func NewReviewDB(db *gorm.DB) *ReviewDB {
	return &ReviewDB{db: db, conflicts: reviewrules.NewConflicts(db)}
}

func (r *ReviewDB) RoleIDs(ctx context.Context, cycleID string) ([]string, error) {
	ids := []string{}
	err := r.db.WithContext(ctx).Model(&models.Role{}).Where("cycle_id = ?", cycleID).Order("name").Pluck("id", &ids).Error
	return ids, err
}

func (r *ReviewDB) Staff(ctx context.Context, cycleID string) ([]models.CycleStaffMember, error) {
	return cyclestaff.NewCycleStaffDB(r.db).ListStaff(ctx, cycleID, "")
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
		Where("a.cycle_id = ? AND a.stage IN ?", cycleID, stages).
		Order("la.assigned_at").Order("la.id")
}

func (r *ReviewDB) SaveAssignments(ctx context.Context, pairs []assign.Pair, assignedBy string) (int, error) {
	rows := make([]leadassignment.LeadAssignmentPair, len(pairs))
	touched := map[string]bool{}
	ids := []string{}
	for i, p := range pairs {
		rows[i] = leadassignment.LeadAssignmentPair{ApplicationID: p.ApplicationID, LeadNUID: p.LeadNUID}
		if !touched[p.ApplicationID] {
			touched[p.ApplicationID] = true
			ids = append(ids, p.ApplicationID)
		}
	}
	created, err := leadassignment.NewLeadAssignmentDB(r.db).CreateLeadAssignments(ctx, rows, assignedBy)
	if err != nil {
		return 0, err
	}
	_, err = application.NewApplicationDB(r.db).AdvanceApplicationsToLeadReview(ctx, ids)
	return created, err
}

func (r *ReviewDB) Locked(ctx context.Context, cycleID string, fn func(reviewStore) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := reviewrules.LockAssignments(tx, cycleID); err != nil {
			return err
		}
		return fn(NewReviewDB(tx))
	})
}

func (r *ReviewDB) ListConflicts(ctx context.Context, cycleID string) ([]reviewrules.Conflict, error) {
	return r.conflicts.List(ctx, cycleID)
}

func (r *ReviewDB) PutConflict(ctx context.Context, cycleID, leadNUID, applicantNUID string) error {
	return r.conflicts.Put(ctx, cycleID, leadNUID, applicantNUID)
}

func (r *ReviewDB) DeleteConflict(ctx context.Context, cycleID, leadNUID, applicantNUID string) error {
	return r.conflicts.Delete(ctx, cycleID, leadNUID, applicantNUID)
}

func (r *ReviewDB) IsStaff(ctx context.Context, cycleID, nuid string) (bool, error) {
	return r.conflicts.IsStaff(ctx, cycleID, nuid)
}

func (r *ReviewDB) HasApplicant(ctx context.Context, cycleID, nuid string) (bool, error) {
	return r.conflicts.HasApplicant(ctx, cycleID, nuid)
}

func (r *ReviewDB) Blocked(ctx context.Context, cycleID string) (reviewrules.Blocked, error) {
	return r.conflicts.Blocked(ctx, cycleID)
}

package leadassignment

import (
	"context"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/reviewrules"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type applicationGate interface {
	CanApplication(ctx context.Context, action access.ApplicationAction, applicationID string) error
	CanApplicationOf(ctx context.Context, action access.ApplicationAction, table, id string) error
	CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error
}

type opening struct {
	CycleID string
	RoleID  string
	Stage   models.ApplicationStage
}

type manualStore interface {
	ApplicationOpening(ctx context.Context, applicationID string) (opening, error)
	AssignmentOpening(ctx context.Context, assignmentID string) (opening, error)
	RoleInCycle(ctx context.Context, cycleID, roleID string) (bool, error)
	Conflicted(ctx context.Context, applicationID, nuid string) (bool, error)
	CountAssignments(ctx context.Context, applicationID string) (int, error)
	List(ctx context.Context, applicationID string) ([]models.LeadAssignment, error)
	Create(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.LeadAssignment, error)
	Delete(ctx context.Context, assignmentID string) error
	DeleteUnsubmitted(ctx context.Context, cycleID, roleID string) (int, error)
	Locked(ctx context.Context, cycleID string, fn func(manualStore) error) error
}

type manualDB struct {
	db *gorm.DB
}

func newManualDB(db *gorm.DB) *manualDB {
	return &manualDB{db: db}
}

func (m *manualDB) ApplicationOpening(ctx context.Context, applicationID string) (opening, error) {
	var o opening
	err := m.db.WithContext(ctx).Model(&models.Application{}).Select("cycle_id, role_id, stage").
		Where("id = ?", applicationID).Take(&o).Error
	return o, utils.DBErr(err)
}

func (m *manualDB) AssignmentOpening(ctx context.Context, assignmentID string) (opening, error) {
	var o opening
	err := m.db.WithContext(ctx).Table("lead_assignments la").Select("a.cycle_id, a.role_id").
		Joins("JOIN applications a ON a.id = la.application_id").
		Where("la.id = ?", assignmentID).Take(&o).Error
	return o, utils.DBErr(err)
}

func (m *manualDB) RoleInCycle(ctx context.Context, cycleID, roleID string) (bool, error) {
	var n int64
	err := m.db.WithContext(ctx).Model(&models.Role{}).Where("id = ? AND cycle_id = ?", roleID, cycleID).Count(&n).Error
	return n > 0, err
}

func (m *manualDB) Conflicted(ctx context.Context, applicationID, nuid string) (bool, error) {
	return reviewrules.NewConflicts(m.db).Conflicted(ctx, applicationID, nuid)
}

func (m *manualDB) CountAssignments(ctx context.Context, applicationID string) (int, error) {
	var n int64
	err := m.db.WithContext(ctx).Model(&models.LeadAssignment{}).Where("application_id = ?", applicationID).Count(&n).Error
	return int(n), err
}

func (m *manualDB) List(ctx context.Context, applicationID string) ([]models.LeadAssignment, error) {
	return NewLeadAssignmentDB(m.db).ListLeadAssignments(ctx, applicationID)
}

func (m *manualDB) Create(ctx context.Context, applicationID, leadNUID, assignedBy string) (models.LeadAssignment, error) {
	return NewLeadAssignmentDB(m.db).CreateLeadAssignment(ctx, applicationID, leadNUID, assignedBy)
}

func (m *manualDB) Delete(ctx context.Context, assignmentID string) error {
	return NewLeadAssignmentDB(m.db).DeleteLeadAssignment(ctx, assignmentID)
}

func (m *manualDB) DeleteUnsubmitted(ctx context.Context, cycleID, roleID string) (int, error) {
	return NewLeadAssignmentDB(m.db).DeleteLeadAssignmentsForCycle(ctx, cycleID, roleID)
}

func (m *manualDB) Locked(ctx context.Context, cycleID string, fn func(manualStore) error) error {
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := reviewrules.LockAssignments(tx, cycleID); err != nil {
			return err
		}
		return fn(newManualDB(tx))
	})
}

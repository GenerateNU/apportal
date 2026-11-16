package accesstest

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

const (
	CycleID       = "11111111-1111-4111-8111-111111111111"
	OtherCycleID  = "22222222-2222-4222-8222-222222222222"
	ApplicationID = "33333333-3333-4333-8333-333333333333"
	AssignmentID  = "44444444-4444-4444-8444-444444444444"
	RoleID        = "55555555-5555-4555-8555-555555555555"

	AdminNUID     = "admin"
	ChiefNUID     = "chief"
	OtherChief    = "chief-elsewhere"
	LeadNUID      = "lead"
	ApplicantNUID = "applicant"
)

// Gate treats every cycle as an open member cycle.
type Gate struct {
	Staff  map[string]map[string]models.CycleStaffRole
	Rows   map[string]string
	Owners map[string]string
}

func Standard() Gate {
	return Gate{
		Staff: map[string]map[string]models.CycleStaffRole{
			CycleID:      {ChiefNUID: models.CycleStaffChief, LeadNUID: models.CycleStaffLead},
			OtherCycleID: {OtherChief: models.CycleStaffChief},
		},
		Rows:   map[string]string{ApplicationID: CycleID, AssignmentID: CycleID},
		Owners: map[string]string{ApplicationID: ApplicantNUID, AssignmentID: ApplicantNUID},
	}
}

func (g Gate) level(ctx context.Context, cycleID string) (access.Level, error) {
	actor, ok := middleware.ActorFrom(ctx)
	if !ok || actor.NUID == "" {
		return access.None, access.RequireActor(ctx)
	}
	return access.LevelFor(access.IsAdmin(actor), g.Staff[cycleID][actor.NUID], models.CycleOpen, models.ApplicationTypeMember), nil
}

func (g Gate) CanCycle(ctx context.Context, action access.CycleAction, cycleID string) error {
	l, err := g.level(ctx, cycleID)
	if err != nil {
		return err
	}
	actor, _ := middleware.ActorFrom(ctx)
	return access.CycleAccessAt(l, access.IsAdmin(actor)).Can(action)
}

func (g Gate) CanApplication(ctx context.Context, action access.ApplicationAction, id string) error {
	l, err := g.level(ctx, g.Rows[id])
	if err != nil {
		return err
	}
	actor, _ := middleware.ActorFrom(ctx)
	return access.ApplicationAccessAt(l, g.Owners[id] != "" && g.Owners[id] == actor.NUID).Can(action)
}

func (g Gate) CanApplicationOf(ctx context.Context, action access.ApplicationAction, _ string, id string) error {
	return g.CanApplication(ctx, action, id)
}

type Persona struct {
	Name string
	Ctx  context.Context
}

func Personas() []Persona {
	as := func(nuid string, roles ...models.UserRole) context.Context {
		return testutil.WithActor(middleware.Actor{NUID: nuid, Roles: roles})
	}
	return []Persona{
		{"admin", as(AdminNUID, models.UserRoleAdmin)},
		{"chief on cycle", as(ChiefNUID, models.UserRoleApplicant)},
		{"chief elsewhere", as(OtherChief, models.UserRoleApplicant)},
		{"lead on cycle", as(LeadNUID, models.UserRoleApplicant)},
		{"applicant", as(ApplicantNUID, models.UserRoleApplicant)},
		{"unauthenticated", context.Background()},
	}
}

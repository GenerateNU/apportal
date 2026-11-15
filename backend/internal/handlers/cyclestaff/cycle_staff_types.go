package cyclestaff

import "github.com/GenerateNU/apportal/backend/internal/models"

type CycleIDInput struct {
	ID string `path:"id"`
}

type StaffMemberInput struct {
	ID   string `path:"id"`
	NUID string `path:"nuid"`
}

type SetStaffInput struct {
	ID   string `path:"id"`
	NUID string `path:"nuid"`
	Body struct {
		Role models.CycleStaffRole `json:"role" doc:"lead or chief"`
	}
}

type StaffOutput struct {
	Body []models.CycleStaffMember
}

type StaffMemberOutput struct {
	Body models.CycleStaff
}

type MyCyclesInput struct{}

type MyCyclesOutput struct {
	Body []models.CycleStaff
}

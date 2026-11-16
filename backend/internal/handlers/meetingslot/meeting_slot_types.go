package meetingslot

import "github.com/GenerateNU/apportal/backend/internal/models"

const maxSlots = 100

type SlotsOutput struct {
	Body []models.MeetingSlot
}

type SlotOutput struct {
	Body models.MeetingSlot
}

type CreateSlotInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Label string `json:"label" minLength:"1" maxLength:"100" doc:"e.g. Tuesday 7pm"`
	}
}

type SlotPathInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	SlotID string `path:"slot_id"`
}

type RenameSlotInput struct {
	ID     string `path:"id" doc:"Cycle ID"`
	SlotID string `path:"slot_id"`
	Body   struct {
		Label string `json:"label" minLength:"1" maxLength:"100"`
	}
}

type ReorderSlotsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		SlotIDs []string `json:"slot_ids" maxItems:"100" doc:"Every slot in the cycle, in the new order"`
	}
}

type StaffSlotsOutput struct {
	Body []models.StaffSlot
}

type StaffSlotPathInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	NUID string `path:"nuid"`
}

type SetStaffSlotInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	NUID string `path:"nuid"`
	Body struct {
		SlotID string `json:"slot_id" doc:"One of the cycle's meeting slots"`
	}
}

type StaffSlotOutput struct {
	Body models.StaffSlot
}

type MatchBySlotInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Enabled bool `json:"enabled"`
	}
}

type MatchBySlotOutput struct {
	Body struct {
		MatchBySlot bool `json:"match_by_slot"`
	}
}

type ApplicationSlots struct {
	Options  []models.MeetingSlot `json:"options" doc:"The cycle's meeting slots"`
	SlotIDs  []string             `json:"slot_ids" doc:"The ones the applicant can make"`
	Editable bool                 `json:"editable"`
}

type ApplicationSlotsOutput struct {
	Body ApplicationSlots
}

type SetApplicationSlotsInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		SlotIDs []string `json:"slot_ids" maxItems:"100"`
	}
}

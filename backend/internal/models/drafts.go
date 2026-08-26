package models

import "time"

// DraftStatus gates what the board allows: teams and order are editable only
// while it's setup, picks only while it's active.
type DraftStatus string

const (
	DraftSetup    DraftStatus = "setup"
	DraftActive   DraftStatus = "active"
	DraftComplete DraftStatus = "complete"
)

func (s DraftStatus) Valid() bool {
	switch s {
	case DraftSetup, DraftActive, DraftComplete:
		return true
	}
	return false
}

// Draft is one (cycle, role) board. Teams pick in snake order — first round
// runs down the order, the next back up it, so the last team picks twice in a
// row at the turn.
type Draft struct {
	ID              string      `json:"id"`
	CycleID         string      `json:"cycle_id"`
	ApplicationRole Role        `json:"application_role"`
	Status          DraftStatus `json:"status"`
	Rounds          int         `json:"rounds"`
	CreatedBy       string      `json:"created_by"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// DraftTeam is one seat in the order, backed by the preference_lists group
// whose members are drafting.
type DraftTeam struct {
	ID               string `json:"id"`
	DraftID          string `json:"draft_id"`
	PreferenceListID string `json:"preference_list_id"`
	Position         int    `json:"position"`
}

// DraftTeamDetail adds the group's name and members, so the board can label a
// column without a fetch per team.
type DraftTeamDetail struct {
	DraftTeam
	Name        string   `json:"name"`
	MemberNames []string `json:"member_names"`
}

type DraftPick struct {
	ID            string    `json:"id"`
	DraftID       string    `json:"draft_id"`
	PickNumber    int       `json:"pick_number"`
	DraftTeamID   string    `json:"draft_team_id"`
	ApplicationID string    `json:"application_id"`
	PreviousStage string    `json:"previous_stage"`
	PickedBy      string    `json:"picked_by"`
	PickedAt      time.Time `json:"picked_at"`
}

// DraftPickDetail enriches a pick with the applicant's name and email, joined
// the same way PreferenceListEntryDetail does.
type DraftPickDetail struct {
	DraftPick
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

// DraftBoard is the whole board in one response: the order, every pick made,
// and which slot is on the clock. OnTheClock is 0 when the board is full or
// not active.
type DraftBoard struct {
	Draft
	Teams []DraftTeamDetail `json:"teams"`
	Picks []DraftPickDetail `json:"picks"`
	// The lowest unfilled slot — undoing a pick mid-board makes that slot the
	// next one, not the end of the list.
	OnTheClock int `json:"on_the_clock"`
	// The team that owns OnTheClock, empty when nothing is.
	OnTheClockTeamID string `json:"on_the_clock_team_id,omitempty"`
}

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
	ID              string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID         string      `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:drafts_cycle_id_application_role_key,priority:1"`
	ApplicationRole Role        `json:"application_role" gorm:"type:application_role;not null;uniqueIndex:drafts_cycle_id_application_role_key,priority:2"`
	Status          DraftStatus `json:"status" gorm:"not null;default:setup;check:drafts_status_check,status IN ('setup','active','complete')"`
	Rounds          int         `json:"rounds" gorm:"type:integer;not null;default:1;check:drafts_rounds_check,rounds > 0"`
	CreatedBy       string      `json:"created_by" gorm:"not null"`
	CreatedAt       time.Time   `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt       time.Time   `json:"updated_at" gorm:"not null;default:now()"`
	Cycle           Cycle       `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Creator         User        `json:"-" gorm:"foreignKey:CreatedBy;references:NUID"`
}

// DraftTeam is one seat in the order, backed by the preference_lists group
// whose members are drafting.
type DraftTeam struct {
	ID               string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	DraftID          string         `json:"draft_id" gorm:"type:uuid;not null;uniqueIndex:draft_teams_draft_id_preference_list_id_key,priority:1;index:idx_draft_teams_draft,priority:1"`
	PreferenceListID string         `json:"preference_list_id" gorm:"type:uuid;not null;uniqueIndex:draft_teams_draft_id_preference_list_id_key,priority:2"`
	Position         int            `json:"position" gorm:"type:integer;not null;index:idx_draft_teams_draft,priority:2"`
	Draft            Draft          `json:"-" gorm:"foreignKey:DraftID;references:ID;constraint:OnDelete:CASCADE"`
	PreferenceList   PreferenceList `json:"-" gorm:"foreignKey:PreferenceListID;references:ID;constraint:OnDelete:CASCADE"`
}

// DraftTeamDetail adds the group's name and members, so the board can label a
// column without a fetch per team.
type DraftTeamDetail struct {
	DraftTeam
	Name        string   `json:"name"`
	MemberNames []string `json:"member_names" gorm:"serializer:pgarray"`
}

type DraftPick struct {
	ID            string      `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	DraftID       string      `json:"draft_id" gorm:"type:uuid;not null;uniqueIndex:draft_picks_draft_id_application_id_key,priority:1;uniqueIndex:draft_picks_draft_id_pick_number_key,priority:1;index:idx_draft_picks_draft,priority:1"`
	PickNumber    int         `json:"pick_number" gorm:"type:integer;not null;check:draft_picks_pick_number_check,pick_number > 0;uniqueIndex:draft_picks_draft_id_pick_number_key,priority:2;index:idx_draft_picks_draft,priority:2"`
	DraftTeamID   string      `json:"draft_team_id" gorm:"type:uuid;not null"`
	ApplicationID string      `json:"application_id" gorm:"type:uuid;not null;index:idx_draft_picks_application;uniqueIndex:draft_picks_draft_id_application_id_key,priority:2"`
	PreviousStage string      `json:"previous_stage" gorm:"type:application_stage;not null"`
	PickedBy      string      `json:"picked_by" gorm:"not null"`
	PickedAt      time.Time   `json:"picked_at" gorm:"not null;default:now()"`
	Draft         Draft       `json:"-" gorm:"foreignKey:DraftID;references:ID;constraint:OnDelete:CASCADE"`
	DraftTeam     DraftTeam   `json:"-" gorm:"foreignKey:DraftTeamID;references:ID;constraint:OnDelete:CASCADE"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Picker        User        `json:"-" gorm:"foreignKey:PickedBy;references:NUID"`
}

// DraftPickDetail enriches a pick with the applicant's name and email, joined
// the same way PreferenceListEntryDetail does.
type DraftPickDetail struct {
	DraftPick
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

// DraftSlot names the team that owns one slot on the board. Sent explicitly
// rather than left to the client to re-derive from the snake: once a live
// board has been reordered, a slot's owner no longer follows from its pick
// number alone.
type DraftSlot struct {
	PickNumber  int    `json:"pick_number"`
	DraftTeamID string `json:"draft_team_id"`
}

// DraftBoard is the whole board in one response: the order, every pick made,
// and which slot is on the clock. OnTheClock is 0 when the board is full or
// not active.
type DraftBoard struct {
	Draft
	Teams []DraftTeamDetail `json:"teams"`
	Picks []DraftPickDetail `json:"picks"`
	// Every slot on the board, in pick order, with the team that owns it.
	Slots []DraftSlot `json:"slots"`
	// The lowest unfilled slot — undoing a pick mid-board makes that slot the
	// next one, not the end of the list.
	OnTheClock int `json:"on_the_clock"`
	// The team that owns OnTheClock, empty when nothing is.
	OnTheClockTeamID string `json:"on_the_clock_team_id,omitempty"`
}

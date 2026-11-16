package models

import "time"

var StaffKinds = []StepKind{KindReviewer, KindInterviewer, KindRecordingReviewer}

func (k StepKind) Staff() bool {
	return k == KindReviewer || k == KindInterviewer || k == KindRecordingReviewer
}

type StaffGroup struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID   string    `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:staff_groups_cycle_id_name_key,priority:1"`
	Name      string    `json:"name" gorm:"not null;uniqueIndex:staff_groups_cycle_id_name_key,priority:2"`
	CreatedAt time.Time `json:"created_at" gorm:"not null;default:now()"`
	Cycle     Cycle     `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

type StaffGroupMember struct {
	GroupID  string     `json:"group_id" gorm:"primaryKey;type:uuid"`
	UserNUID string     `json:"user_nuid" gorm:"primaryKey;index:idx_staff_group_members_user"`
	AddedAt  time.Time  `json:"added_at" gorm:"not null;default:now()"`
	Group    StaffGroup `json:"-" gorm:"foreignKey:GroupID;references:ID;constraint:OnDelete:CASCADE"`
	User     User       `json:"-" gorm:"foreignKey:UserNUID;references:NUID;constraint:OnDelete:CASCADE"`
}

type OpeningTeam struct {
	CycleID string     `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	RoleID  string     `json:"role_id" gorm:"primaryKey;type:uuid"`
	Kind    StepKind   `json:"kind" gorm:"primaryKey;type:text;check:opening_teams_kind_check,kind IN ('reviewer', 'interviewer', 'recording_reviewer')"`
	GroupID string     `json:"group_id" gorm:"primaryKey;type:uuid;index:idx_opening_teams_group"`
	Cycle   Cycle      `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Role    Role       `json:"-" gorm:"foreignKey:RoleID;references:ID;constraint:OnDelete:CASCADE"`
	Group   StaffGroup `json:"-" gorm:"foreignKey:GroupID;references:ID;constraint:OnDelete:CASCADE"`
}

type InterviewPanel struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID   string    `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:interview_panels_cycle_id_name_key,priority:1"`
	Name      string    `json:"name" gorm:"not null;uniqueIndex:interview_panels_cycle_id_name_key,priority:2"`
	CreatedBy string    `json:"created_by" gorm:"not null"`
	CreatedAt time.Time `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt time.Time `json:"updated_at" gorm:"not null;default:now()"`
	Cycle     Cycle     `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Creator   User      `json:"-" gorm:"foreignKey:CreatedBy;references:NUID"`
}

type InterviewPanelMember struct {
	PanelID  string         `json:"panel_id" gorm:"primaryKey;type:uuid"`
	UserNUID string         `json:"user_nuid" gorm:"primaryKey;uniqueIndex:interview_panel_members_cycle_id_user_nuid_key,priority:2"`
	CycleID  string         `json:"-" gorm:"type:uuid;not null;uniqueIndex:interview_panel_members_cycle_id_user_nuid_key,priority:1"`
	AddedAt  time.Time      `json:"added_at" gorm:"not null;default:now()"`
	Panel    InterviewPanel `json:"-" gorm:"foreignKey:PanelID;references:ID;constraint:OnDelete:CASCADE"`
	User     User           `json:"-" gorm:"foreignKey:UserNUID;references:NUID"`
}

type PanelMember struct {
	PanelID  string `json:"-"`
	UserNUID string `json:"user_nuid"`
	FullName string `json:"full_name"`
}

type InterviewPanelDetail struct {
	InterviewPanel
	Members []PanelMember `json:"members" gorm:"-"`
}

type MeetingSlot struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID   string    `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:meeting_slots_cycle_id_label_key,priority:1"`
	Label     string    `json:"label" gorm:"not null;uniqueIndex:meeting_slots_cycle_id_label_key,priority:2"`
	Position  int       `json:"position" gorm:"type:integer;not null;default:0"`
	CreatedAt time.Time `json:"created_at" gorm:"not null;default:now()"`
	Cycle     Cycle     `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
}

type StaffSlot struct {
	CycleID  string      `json:"cycle_id" gorm:"primaryKey;type:uuid"`
	UserNUID string      `json:"user_nuid" gorm:"primaryKey"`
	SlotID   string      `json:"slot_id" gorm:"type:uuid;not null;index:idx_staff_slots_slot"`
	Cycle    Cycle       `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	User     User        `json:"-" gorm:"foreignKey:UserNUID;references:NUID;constraint:OnDelete:CASCADE"`
	Slot     MeetingSlot `json:"-" gorm:"foreignKey:SlotID;references:ID;constraint:OnDelete:CASCADE"`
}

type ApplicationSlot struct {
	ApplicationID string      `json:"application_id" gorm:"primaryKey;type:uuid"`
	SlotID        string      `json:"slot_id" gorm:"primaryKey;type:uuid;index:idx_application_slots_slot"`
	Application   Application `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Slot          MeetingSlot `json:"-" gorm:"foreignKey:SlotID;references:ID;constraint:OnDelete:CASCADE"`
}

package models

import (
	"time"
)

// PreferenceListStatus is a lead-toggleable status flag, not a hard lock —
// the (cycle, role) deadline in PreferenceListDeadline is what actually
// stops edits.
type PreferenceListStatus string

const (
	PreferenceListDraft     PreferenceListStatus = "draft"
	PreferenceListSubmitted PreferenceListStatus = "submitted"
)

func (s PreferenceListStatus) Valid() bool {
	switch s {
	case PreferenceListDraft, PreferenceListSubmitted:
		return true
	}
	return false
}

// PreferenceList is one lead-created, collaboratively-edited group ranking
// applicants for a cycle across every role — membership (see
// PreferenceListMember), not authorship, is the access boundary. Role isn't
// a property of the list itself: each entry (see PreferenceListEntry)
// belongs to whichever role its application has, so one group manages every
// role's ranking rather than needing a separate list per role.
//
// MeetingDay is the weekly slot (matching the day-of-week set the
// application's own "Meeting Availability" question offers) this list's
// members have settled on for meeting to go through it together — nil until
// they choose one.
type PreferenceList struct {
	ID          string               `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID     string               `json:"cycle_id" gorm:"type:uuid;not null;index:idx_preference_lists_cycle"`
	Name        string               `json:"name" gorm:"not null"`
	Status      PreferenceListStatus `json:"status" gorm:"not null;default:draft;check:preference_lists_status_check,status IN ('draft','submitted')"`
	CreatedBy   string               `json:"created_by" gorm:"not null"`
	SubmittedAt *time.Time           `json:"submitted_at,omitempty"`
	CreatedAt   time.Time            `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt   time.Time            `json:"updated_at" gorm:"not null;default:now()"`
	MeetingDay  *string              `json:"meeting_day,omitempty" gorm:"check:preference_lists_meeting_day_check,meeting_day IN ('monday','tuesday','wednesday','thursday')"`
	Cycle       Cycle                `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	Creator     User                 `json:"-" gorm:"foreignKey:CreatedBy;references:NUID"`
}

// PreferenceListSummary adds membership/entry counts and member names for
// the index page, so it doesn't need a separate fetch per list (or a second
// round trip to resolve names) to show who's on each list.
type PreferenceListSummary struct {
	PreferenceList
	MemberCount int      `json:"member_count"`
	EntryCount  int      `json:"entry_count"`
	MemberNames []string `json:"member_names" gorm:"serializer:pgarray"`
}

type PreferenceListMember struct {
	ID               string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PreferenceListID string         `json:"preference_list_id" gorm:"type:uuid;not null;uniqueIndex:preference_list_members_preference_list_id_lead_nuid_key,priority:1"`
	LeadNUID         string         `json:"lead_nuid" gorm:"not null;index:idx_preference_list_members_lead;uniqueIndex:preference_list_members_preference_list_id_lead_nuid_key,priority:2"`
	AddedBy          string         `json:"added_by" gorm:"not null"`
	AddedAt          time.Time      `json:"added_at" gorm:"not null;default:now()"`
	PreferenceList   PreferenceList `json:"-" gorm:"foreignKey:PreferenceListID;references:ID;constraint:OnDelete:CASCADE"`
	Lead             User           `json:"-" gorm:"foreignKey:LeadNUID;references:NUID"`
	Adder            User           `json:"-" gorm:"foreignKey:AddedBy;references:NUID"`
}

type PreferenceListEntry struct {
	ID               string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PreferenceListID string         `json:"preference_list_id" gorm:"type:uuid;not null;index:idx_preference_list_entries_list;uniqueIndex:preference_list_entries_preference_list_id_application_id_key,priority:1"`
	ApplicationID    string         `json:"application_id" gorm:"type:uuid;not null;uniqueIndex:preference_list_entries_preference_list_id_application_id_key,priority:2"`
	Rank             int            `json:"rank" gorm:"type:integer;not null"`
	Reasoning        *string        `json:"reasoning,omitempty"`
	UpdatedBy        string         `json:"updated_by" gorm:"not null"`
	CreatedAt        time.Time      `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"not null;default:now()"`
	PreferenceList   PreferenceList `json:"-" gorm:"foreignKey:PreferenceListID;references:ID;constraint:OnDelete:CASCADE"`
	Application      Application    `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Updater          User           `json:"-" gorm:"foreignKey:UpdatedBy;references:NUID"`
}

// PreferenceListEntryDetail enriches an entry with the applicant's display
// name/email/role, joined from applications+users — same shape
// ApplicationSummary bundles onto a bare application row. ApplicationRole
// isn't stored on the entry itself; it's read off the joined application so
// the frontend can split one group's entries into per-role tabs without a
// second lookup.
type PreferenceListEntryDetail struct {
	PreferenceListEntry
	FullName        string `json:"full_name"`
	Email           string `json:"email"`
	ApplicationRole Role   `json:"application_role"`
	Returner        bool   `json:"returner"`
}

// PreferenceListPersonalEntry is one lead's own private ranking of an
// applicant within a group — same shape as PreferenceListEntry but scoped to
// OwnerNUID. Visible to every group member and chiefs/admins, but only the
// owner can ever write to it, and (unlike PreferenceListEntry) it's never
// deadline-gated.
type PreferenceListPersonalEntry struct {
	ID               string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PreferenceListID string         `json:"preference_list_id" gorm:"type:uuid;not null;index:idx_preference_list_personal_entries_list_owner,priority:1;uniqueIndex:preference_list_personal_entr_preference_list_id_owner_nuid_key,priority:1"`
	OwnerNUID        string         `json:"owner_nuid" gorm:"not null;index:idx_preference_list_personal_entries_list_owner,priority:2;uniqueIndex:preference_list_personal_entr_preference_list_id_owner_nuid_key,priority:2"`
	ApplicationID    string         `json:"application_id" gorm:"type:uuid;not null;uniqueIndex:preference_list_personal_entr_preference_list_id_owner_nuid_key,priority:3"`
	Rank             int            `json:"rank" gorm:"type:integer;not null"`
	Reasoning        *string        `json:"reasoning,omitempty"`
	CreatedAt        time.Time      `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"not null;default:now()"`
	PreferenceList   PreferenceList `json:"-" gorm:"foreignKey:PreferenceListID;references:ID;constraint:OnDelete:CASCADE"`
	Owner            User           `json:"-" gorm:"foreignKey:OwnerNUID;references:NUID"`
	Application      Application    `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
}

// PreferenceListPersonalEntryDetail mirrors PreferenceListEntryDetail, plus
// the owning lead's own display name so the frontend can label each personal
// list ("<Name>'s list") without a separate user lookup.
type PreferenceListPersonalEntryDetail struct {
	PreferenceListPersonalEntry
	OwnerName       string `json:"owner_name"`
	FullName        string `json:"full_name"`
	Email           string `json:"email"`
	ApplicationRole Role   `json:"application_role"`
	Returner        bool   `json:"returner"`
}

// PreferenceListComment is an open comment within a group's shared list —
// mirrors InterviewComment's shape (any member may post, edit only their
// own). ApplicationID nil means a comment on the group as a whole; set means
// a comment on that one applicant/entry. Scoped to the shared list only, not
// personal lists.
type PreferenceListComment struct {
	ID               string         `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PreferenceListID string         `json:"preference_list_id" gorm:"type:uuid;not null;index:idx_preference_list_comments_list"`
	ApplicationID    *string        `json:"application_id,omitempty" gorm:"type:uuid"`
	AuthorNUID       string         `json:"author_nuid" gorm:"not null"`
	Body             string         `json:"body" gorm:"not null"`
	CreatedAt        time.Time      `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"not null;default:now()"`
	PreferenceList   PreferenceList `json:"-" gorm:"foreignKey:PreferenceListID;references:ID;constraint:OnDelete:CASCADE"`
	Application      *Application   `json:"-" gorm:"foreignKey:ApplicationID;references:ID;constraint:OnDelete:CASCADE"`
	Author           User           `json:"-" gorm:"foreignKey:AuthorNUID;references:NUID"`
}

// PreferenceListCommentDetail bundles a comment with the author's resolved
// display name (not a table column).
type PreferenceListCommentDetail struct {
	PreferenceListComment
	AuthorName string `json:"author_name,omitempty"`
}

// PreferenceListDetail bundles a list with its members, shared entries,
// every member's personal entries, and every comment (group-level and
// per-entry) for a single detail-page fetch, like WrittenReviewDetail
// bundling a review with its answers — everything is fetched in bulk here
// rather than once per member/entry.
type PreferenceListDetail struct {
	PreferenceList
	Members         []PreferenceListMember              `json:"members"`
	Entries         []PreferenceListEntryDetail         `json:"entries"`
	PersonalEntries []PreferenceListPersonalEntryDetail `json:"personal_entries"`
	Comments        []PreferenceListCommentDetail       `json:"comments"`
}

// PreferenceListDeadline is a per-(cycle, role) settings row — not a column
// on PreferenceList itself, since one deadline governs every list sharing
// that (cycle, role), not just the list that happens to store it.
type PreferenceListDeadline struct {
	ID              string     `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	CycleID         string     `json:"cycle_id" gorm:"type:uuid;not null;uniqueIndex:preference_list_deadlines_cycle_id_application_role_key,priority:1"`
	ApplicationRole Role       `json:"application_role" gorm:"type:application_role;not null;uniqueIndex:preference_list_deadlines_cycle_id_application_role_key,priority:2"`
	ClosesAt        *time.Time `json:"closes_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at" gorm:"not null;default:now()"`
	UpdatedBy       *string    `json:"updated_by,omitempty"`
	Cycle           Cycle      `json:"-" gorm:"foreignKey:CycleID;references:ID;constraint:OnDelete:CASCADE"`
	UpdatedByUser   *User      `json:"-" gorm:"foreignKey:UpdatedBy;references:NUID"`
}

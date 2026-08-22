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
	ID          string               `json:"id"`
	CycleID     string               `json:"cycle_id"`
	Name        string               `json:"name"`
	Status      PreferenceListStatus `json:"status"`
	CreatedBy   string               `json:"created_by"`
	SubmittedAt *time.Time           `json:"submitted_at,omitempty"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
	MeetingDay  *string              `json:"meeting_day,omitempty"`
}

// PreferenceListSummary adds membership/entry counts and member names for
// the index page, so it doesn't need a separate fetch per list (or a second
// round trip to resolve names) to show who's on each list.
type PreferenceListSummary struct {
	PreferenceList
	MemberCount int      `json:"member_count"`
	EntryCount  int      `json:"entry_count"`
	MemberNames []string `json:"member_names"`
}

type PreferenceListMember struct {
	ID               string    `json:"id"`
	PreferenceListID string    `json:"preference_list_id"`
	LeadNUID         string    `json:"lead_nuid"`
	AddedBy          string    `json:"added_by"`
	AddedAt          time.Time `json:"added_at"`
}

type PreferenceListEntry struct {
	ID               string    `json:"id"`
	PreferenceListID string    `json:"preference_list_id"`
	ApplicationID    string    `json:"application_id"`
	Rank             int       `json:"rank"`
	Reasoning        *string   `json:"reasoning,omitempty"`
	UpdatedBy        string    `json:"updated_by"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
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
}

// PreferenceListPersonalEntry is one lead's own private ranking of an
// applicant within a group — same shape as PreferenceListEntry but scoped to
// OwnerNUID. Visible to every group member and chiefs/admins, but only the
// owner can ever write to it, and (unlike PreferenceListEntry) it's never
// deadline-gated.
type PreferenceListPersonalEntry struct {
	ID               string    `json:"id"`
	PreferenceListID string    `json:"preference_list_id"`
	OwnerNUID        string    `json:"owner_nuid"`
	ApplicationID    string    `json:"application_id"`
	Rank             int       `json:"rank"`
	Reasoning        *string   `json:"reasoning,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
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
}

// PreferenceListComment is an open comment within a group's shared list —
// mirrors InterviewComment's shape (any member may post, edit only their
// own). ApplicationID nil means a comment on the group as a whole; set means
// a comment on that one applicant/entry. Scoped to the shared list only, not
// personal lists.
type PreferenceListComment struct {
	ID               string    `json:"id"`
	PreferenceListID string    `json:"preference_list_id"`
	ApplicationID    *string   `json:"application_id,omitempty"`
	AuthorNUID       string    `json:"author_nuid"`
	Body             string    `json:"body"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
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
	ID              string     `json:"id"`
	CycleID         string     `json:"cycle_id"`
	ApplicationRole Role       `json:"application_role"`
	ClosesAt        *time.Time `json:"closes_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
	UpdatedBy       *string    `json:"updated_by,omitempty"`
}

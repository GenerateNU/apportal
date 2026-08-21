package models

import "time"

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

// PreferenceList is one lead-created, collaboratively-edited ranked list of
// applicants for a (cycle, role). Multiple lists can coexist per (cycle,
// role) — membership (see PreferenceListMember), not authorship, is the
// access boundary.
type PreferenceList struct {
	ID              string               `json:"id"`
	CycleID         string               `json:"cycle_id"`
	ApplicationRole Role                 `json:"application_role"`
	Name            string               `json:"name"`
	Status          PreferenceListStatus `json:"status"`
	CreatedBy       string               `json:"created_by"`
	SubmittedAt     *time.Time           `json:"submitted_at,omitempty"`
	CreatedAt       time.Time            `json:"created_at"`
	UpdatedAt       time.Time            `json:"updated_at"`
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
// name/email, joined from applications+users — same shape ApplicationSummary
// bundles onto a bare application row.
type PreferenceListEntryDetail struct {
	PreferenceListEntry
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

// PreferenceListDetail bundles a list with its members and ordered entries
// for a single detail-page fetch, like WrittenReviewDetail bundling a review
// with its answers.
type PreferenceListDetail struct {
	PreferenceList
	Members []PreferenceListMember      `json:"members"`
	Entries []PreferenceListEntryDetail `json:"entries"`
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

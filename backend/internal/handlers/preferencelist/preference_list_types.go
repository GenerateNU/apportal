package preferencelist

import (
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type PreferenceListOutput struct {
	Body models.PreferenceList
}

type PreferenceListDetailOutput struct {
	Body models.PreferenceListDetail
}

type PreferenceListsOutput struct {
	Body []models.PreferenceListSummary
}

type CreatePreferenceListInput struct {
	Body struct {
		CycleID string `json:"cycle_id"`
		Name    string `json:"name"`
	}
}

type ListPreferenceListsInput struct {
	CycleID string `query:"cycle_id" doc:"Cycle ID"`
}

type PreferenceListDetailsOutput struct {
	Body []models.PreferenceListDetail
}

type UpdatePreferenceListInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		Name   *string                      `json:"name,omitempty"`
		Status *models.PreferenceListStatus `json:"status,omitempty"`
	}
}

type PreferenceListMemberOutput struct {
	Body models.PreferenceListMember
}

type AddPreferenceListMemberInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		LeadNUID string `json:"lead_nuid"`
	}
}

type PreferenceListMemberScopedInput struct {
	ID       string `path:"id" doc:"Preference list ID"`
	MemberID string `path:"memberId" doc:"Preference list member ID"`
}

type PreferenceListEntryOutput struct {
	Body models.PreferenceListEntry
}

type PreferenceListEntryScopedInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
}

type UpsertPreferenceListEntryInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
	Body          struct {
		// nil leaves any existing reasoning untouched; pass "" to clear it.
		Reasoning *string `json:"reasoning,omitempty"`
	}
}

type ReorderPreferenceListEntriesInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		ApplicationIDs []string `json:"application_ids"`
	}
}

type PreferenceListEntriesDetailOutput struct {
	Body []models.PreferenceListEntryDetail
}

type PreferenceListDeadlineOutput struct {
	Body models.PreferenceListDeadline
}

type PreferenceListDeadlineInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type SetPreferenceListDeadlineInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
	Body struct {
		ClosesAt *time.Time `json:"closes_at,omitempty"`
	}
}

type SetPreferenceListMeetingDayInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		MeetingDay *string `json:"meeting_day,omitempty" doc:"monday, tuesday, wednesday, or thursday; omit/null to clear"`
	}
}

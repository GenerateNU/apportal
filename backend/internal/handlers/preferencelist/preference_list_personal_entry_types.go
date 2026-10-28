package preferencelist

import "github.com/GenerateNU/apportal/backend/internal/models"

// Personal-list routes always act on the calling actor's own entries — there
// is no owner in the URL, since "personal" only ever means "mine" for
// writes. Reads (GetPreferenceListDetail's PersonalEntries) return every
// member's personal entries together, since the whole group can see them.
type PreferenceListPersonalEntryOutput struct {
	Body models.PreferenceListPersonalEntry
}

type UpsertPreferenceListPersonalEntryInput struct {
	ID            string `path:"id" doc:"Preference list ID"`
	ApplicationID string `path:"applicationId" doc:"Application ID"`
	Body          struct {
		// nil leaves any existing reasoning untouched; pass "" to clear it.
		Reasoning *string `json:"reasoning,omitempty"`
	}
}

type ReorderPreferenceListPersonalEntriesInput struct {
	ID   string `path:"id" doc:"Preference list ID"`
	Body struct {
		ApplicationIDs []string `json:"application_ids"`
	}
}

type PreferenceListPersonalEntriesDetailOutput struct {
	Body []models.PreferenceListPersonalEntryDetail
}

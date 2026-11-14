package tag

import "github.com/GenerateNU/apportal/backend/internal/models"

// MaxTagsPerApplication mirrors the CHECK on applications.tag_ids.
const MaxTagsPerApplication = 3

// maxNameLen keeps a pasted paragraph from becoming a tag.
const maxNameLen = 40

type TagOutput struct {
	Body models.CycleTag
}

type TagsOutput struct {
	Body []models.CycleTag
}

type CreateTagInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Name string `json:"name"`
	}
}

type UpdateTagInput struct {
	ID   string `path:"id" doc:"Tag ID"`
	Body struct {
		Name  *string `json:"name,omitempty"`
		Color *string `json:"color,omitempty" doc:"One of the palette colors"`
	}
}

type SetApplicationTagsInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		TagIDs []string `json:"tag_ids" doc:"Replaces the application's tags; at most 3, all from its cycle"`
	}
}

type ApplicationTagsOutput struct {
	Body struct {
		TagIDs []string `json:"tag_ids"`
	}
}

package question

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type QuestionOutput struct {
	Body models.Question
}

type QuestionsOutput struct {
	Body []models.Question
}

type CreateQuestionInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         *models.Role        `json:"role,omitempty" doc:"Omit for a global question shown to all roles"`
		QuestionText string              `json:"question_text"`
		QuestionType models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool               `json:"is_required,omitempty"`
		DisplayOrder int                 `json:"display_order,omitempty"`
		Options      json.RawMessage     `json:"options,omitempty"`
		PageTitle    *string             `json:"page_title,omitempty" doc:"Set to start a new page at this question. Role-specific questions only."`
	}
}

type ListQuestionsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

type UpdateQuestionInput struct {
	ID   string `path:"id" doc:"Question ID"`
	Body struct {
		QuestionText   *string              `json:"question_text,omitempty"`
		QuestionType   *models.QuestionType `json:"question_type,omitempty"`
		IsRequired     *bool                `json:"is_required,omitempty"`
		DisplayOrder   *int                 `json:"display_order,omitempty"`
		Options        json.RawMessage      `json:"options,omitempty"`
		PageTitle      *string              `json:"page_title,omitempty" doc:"Set to start (or rename) a page at this question"`
		ClearPageTitle bool                 `json:"clear_page_title,omitempty" doc:"Set true to stop this question from starting a page"`
	}
}

type DeleteQuestionInput struct {
	ID string `path:"id" doc:"Question ID"`
}

type QuestionCreate struct {
	CycleID      string
	Role         *models.Role // nil = global (shown to all roles)
	QuestionText string
	QuestionType models.QuestionType
	IsRequired   bool
	DisplayOrder int
	Options      json.RawMessage
	PageTitle    *string
}

type QuestionUpdate struct {
	QuestionText *string
	QuestionType *models.QuestionType
	IsRequired   *bool
	DisplayOrder *int
	Options      json.RawMessage
	// A nil PageTitle can't mean "clear", so clearing needs its own flag.
	PageTitle      *string
	ClearPageTitle bool
}

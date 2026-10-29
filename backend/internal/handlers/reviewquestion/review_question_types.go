package reviewquestion

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ReviewQuestionOutput struct {
	Body models.ReviewQuestion
}

type ReviewQuestionsOutput struct {
	Body []models.ReviewQuestion
}

type ListReviewQuestionsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Optional role filter"`
}

type CreateReviewQuestionInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         *models.Role        `json:"role,omitempty" doc:"Omit for a global question shown for all roles"`
		QuestionText string              `json:"question_text"`
		QuestionType models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool               `json:"is_required,omitempty"`
		DisplayOrder int                 `json:"display_order,omitempty"`
		Options      json.RawMessage     `json:"options,omitempty"`
		Description  *string             `json:"description,omitempty" doc:"Markdown help text shown under the question's label"`
	}
}

type UpdateReviewQuestionInput struct {
	ID   string `path:"id" doc:"Review question ID"`
	Body struct {
		QuestionText     *string              `json:"question_text,omitempty"`
		QuestionType     *models.QuestionType `json:"question_type,omitempty"`
		IsRequired       *bool                `json:"is_required,omitempty"`
		DisplayOrder     *int                 `json:"display_order,omitempty"`
		Options          json.RawMessage      `json:"options,omitempty"`
		Description      *string              `json:"description,omitempty" doc:"Markdown help text shown under the question's label"`
		ClearDescription bool                 `json:"clear_description,omitempty" doc:"Set true to remove this question's help text"`
	}
}

type DeleteReviewQuestionInput struct {
	ID string `path:"id" doc:"Review question ID"`
}

type ReviewQuestionCreate struct {
	CycleID      string
	Role         *models.Role // nil = global (shown for all roles)
	QuestionText string
	QuestionType models.QuestionType
	IsRequired   bool
	DisplayOrder int
	Options      json.RawMessage
	Description  *string
}

type ReviewQuestionUpdate struct {
	QuestionText     *string
	QuestionType     *models.QuestionType
	IsRequired       *bool
	DisplayOrder     *int
	Options          json.RawMessage
	Description      *string
	ClearDescription bool
}

// ReviewQuestionAverageRow is one lead's average on one review question,
// before grouping by lead.
type ReviewQuestionAverageRow struct {
	LeadNUID         string
	ReviewQuestionID string
	AvgScore         float64
	Count            int
}

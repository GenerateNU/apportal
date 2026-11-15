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
	ID     string `path:"id" doc:"Cycle ID"`
	RoleID string `query:"role_id" doc:"Optional role filter"`
}

type CreateReviewQuestionInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		RoleID       *string             `json:"role_id,omitempty" doc:"Omit for a global question shown for all roles"`
		QuestionText string              `json:"question_text"`
		QuestionType models.QuestionType `json:"question_type,omitempty"`
		IsRequired   *bool               `json:"is_required,omitempty"`
		DisplayOrder int                 `json:"display_order,omitempty"`
		Options      json.RawMessage     `json:"options,omitempty"`
		Description  *string             `json:"description,omitempty" doc:"Markdown help text shown under the question's label"`
		ScoreMin     *int                `json:"score_min,omitempty" doc:"Score questions only; defaults to 1"`
		ScoreMax     *int                `json:"score_max,omitempty" doc:"Score questions only; defaults to 10"`
		Ranked       *bool               `json:"ranked,omitempty" doc:"Whether a score question counts toward the review ranking; defaults to true"`
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
		ScoreMin         *int                 `json:"score_min,omitempty" doc:"Score questions only; locked once any review has scored it"`
		ScoreMax         *int                 `json:"score_max,omitempty" doc:"Score questions only; locked once any review has scored it"`
		Ranked           *bool                `json:"ranked,omitempty" doc:"Whether a score question counts toward the review ranking"`
	}
}

type DeleteReviewQuestionInput struct {
	ID string `path:"id" doc:"Review question ID"`
}

type ReviewQuestionCreate struct {
	CycleID      string
	RoleID       *string // nil = global (shown for all roles)
	QuestionText string
	QuestionType models.QuestionType
	IsRequired   bool
	DisplayOrder int
	Options      json.RawMessage
	Description  *string
	ScoreMin     *int
	ScoreMax     *int
	Ranked       bool
}

type ReviewQuestionUpdate struct {
	QuestionText     *string
	QuestionType     *models.QuestionType
	IsRequired       *bool
	DisplayOrder     *int
	Options          json.RawMessage
	Description      *string
	ClearDescription bool
	SetScale         bool
	ScoreMin         *int
	ScoreMax         *int
	Ranked           *bool
}

// ReviewQuestionAverageRow is one lead's average on one review question,
// before grouping by lead.
type ReviewQuestionAverageRow struct {
	LeadNUID         string
	ReviewQuestionID string
	AvgScore         float64
	Count            int
}

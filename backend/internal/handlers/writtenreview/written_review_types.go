package writtenreview

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type WrittenReviewOutput struct {
	Body models.WrittenReviewDetail
}

type WrittenReviewsOutput struct {
	Body []models.WrittenReviewDetail
}

// ReviewAnswerSubmission is a reviewer's answer to one of the cycle/role's
// review_questions.
type ReviewAnswerSubmission struct {
	ReviewQuestionID string          `json:"review_question_id"`
	AnswerText       *string         `json:"answer_text,omitempty"`
	AnswerOptions    json.RawMessage `json:"answer_options,omitempty"`
	Score            *int            `json:"score,omitempty" doc:"For score questions when the cycle rubric is score; must be within the cycle's range"`
	CategoryID       *string         `json:"category_id,omitempty" doc:"For score questions when the cycle rubric is category"`
}

type UpsertWrittenReviewInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Submit  bool                     `json:"submit,omitempty" doc:"When true, marks the review as submitted"`
		Answers []ReviewAnswerSubmission `json:"answers,omitempty"`
	}
}

// ReviewAnswerInput is a reviewer's answer to one review question.
type ReviewAnswerInput struct {
	ReviewQuestionID string
	AnswerText       *string
	AnswerOptions    json.RawMessage
	Score            *int
	CategoryID       *string
}

type answerRules struct {
	CycleID   string
	Role      models.Role
	Rubric    models.ReviewRubric
	ScoreMin  int
	ScoreMax  int
	Questions map[string]models.ReviewQuestion
	Category  map[string]bool
}

// WrittenReviewUpsert carries a reviewer's full written review for an application.
type WrittenReviewUpsert struct {
	ApplicationID string
	ReviewerNUID  string
	Submit        bool // when true, stamps submitted_at = NOW()
	Answers       []ReviewAnswerInput
}

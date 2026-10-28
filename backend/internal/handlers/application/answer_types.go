package application

import (
	"encoding/json"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ListAnswersBulkInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

type AnswersOutput struct {
	Body []models.WrittenAnswer
}

type UpsertAnswersInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Answers []struct {
			QuestionID     string          `json:"question_id"`
			AnswerText     *string         `json:"answer_text,omitempty"`
			AnswerOptions  json.RawMessage `json:"answer_options,omitempty"`
			AnswerFilePath *string         `json:"answer_file_path,omitempty"`
			AnswerFileName *string         `json:"answer_file_name,omitempty"`
		} `json:"answers" minItems:"1"`
	}
}

type ListAnswersInput struct {
	ID string `path:"id" doc:"Application ID"`
}

package answer

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/handlers/question"
	"github.com/GenerateNU/apportal/backend/internal/storage"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

func Route(api huma.API, db *gorm.DB, storageClient *storage.Client) {
	answers := NewAnswerDB(db)
	registerAnswer(api, &answerService{access: access.NewChecker(db), answers: answers, workflow: workflow.NewService(db)})
	registerUpload(api, &uploadService{access: access.NewChecker(db), answers: answers, questionDB: question.NewQuestionDB(db), storage: storageClient})
}

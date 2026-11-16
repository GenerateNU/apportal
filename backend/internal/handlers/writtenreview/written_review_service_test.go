package writtenreview

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func ip(v int) *int { return &v }

func TestValidateAnswers(t *testing.T) {
	text := "ok"
	questions := map[string]models.ReviewQuestion{
		"five": {ID: "five", QuestionText: "Five", QuestionType: models.QuestionScore, ScoreMin: ip(1), ScoreMax: ip(5)},
		"zero": {ID: "zero", QuestionText: "Zero", QuestionType: models.QuestionScore, ScoreMin: ip(0), ScoreMax: ip(3)},
		"note": {ID: "note", QuestionText: "Note", QuestionType: models.QuestionLongAnswer},
	}
	ok := [][]ReviewAnswerInput{
		{{ReviewQuestionID: "five", Score: ip(1)}, {ReviewQuestionID: "five", Score: ip(5)}},
		{{ReviewQuestionID: "zero", Score: ip(0)}},
		{{ReviewQuestionID: "note", AnswerText: &text}},
		{{ReviewQuestionID: "five"}},
	}
	for _, answers := range ok {
		if err := validateAnswers(answers, questions); err != nil {
			t.Errorf("%+v: %v", answers, err)
		}
	}
	bad := [][]ReviewAnswerInput{
		{{ReviewQuestionID: "five", Score: ip(0)}},
		{{ReviewQuestionID: "five", Score: ip(6)}},
		{{ReviewQuestionID: "zero", Score: ip(-1)}},
		{{ReviewQuestionID: "note", Score: ip(3)}},
		{{ReviewQuestionID: "elsewhere", AnswerText: &text}},
	}
	for _, answers := range bad {
		testutil.WantStatus(t, validateAnswers(answers, questions), http.StatusUnprocessableEntity)
	}
}

func TestUpsertRequiresActor(t *testing.T) {
	_, err := (&writtenReviewService{}).upsert(context.Background(), &UpsertWrittenReviewInput{ID: "a1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

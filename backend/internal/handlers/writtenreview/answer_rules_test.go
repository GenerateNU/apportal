package writtenreview

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func ptr[T any](v T) *T { return &v }

func rules(rubric models.ReviewRubric) answerRules {
	eng := models.RoleSoftwareEngineer
	design := models.RoleSoftwareDesigner
	return answerRules{
		CycleID: "c1", Role: eng, Rubric: rubric, ScoreMin: 1, ScoreMax: 5,
		Questions: map[string]models.ReviewQuestion{
			"score":     {ID: "score", CycleID: "c1", QuestionType: models.QuestionScore},
			"text":      {ID: "text", CycleID: "c1", QuestionType: models.QuestionLongAnswer},
			"design":    {ID: "design", CycleID: "c1", Role: &design, QuestionType: models.QuestionScore},
			"elsewhere": {ID: "elsewhere", CycleID: "c2", QuestionType: models.QuestionScore},
		},
		Category: map[string]bool{"strong": true},
	}
}

func TestAnswerRules(t *testing.T) {
	cases := []struct {
		name   string
		rubric models.ReviewRubric
		in     ReviewAnswerInput
		ok     bool
	}{
		{"score in range", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "score", Score: ptr(5)}, true},
		{"score above max", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "score", Score: ptr(6)}, false},
		{"score below min", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "score", Score: ptr(0)}, false},
		{"category on score rubric", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "score", CategoryID: ptr("strong")}, false},
		{"cleared score", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "score"}, true},
		{"known category", models.RubricCategory, ReviewAnswerInput{ReviewQuestionID: "score", CategoryID: ptr("strong")}, true},
		{"unknown category", models.RubricCategory, ReviewAnswerInput{ReviewQuestionID: "score", CategoryID: ptr("other")}, false},
		{"score on category rubric", models.RubricCategory, ReviewAnswerInput{ReviewQuestionID: "score", Score: ptr(3)}, false},
		{"text answer", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "text", AnswerText: ptr("hi")}, true},
		{"score on text question", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "text", Score: ptr(3)}, false},
		{"other role's question", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "design", Score: ptr(3)}, false},
		{"other cycle's question", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "elsewhere", Score: ptr(3)}, false},
		{"unknown question", models.RubricScore, ReviewAnswerInput{ReviewQuestionID: "missing"}, false},
	}
	for _, c := range cases {
		err := rules(c.rubric).check(c.in)
		if (err == nil) != c.ok {
			t.Errorf("%s: err = %v, want ok=%v", c.name, err, c.ok)
		}
	}
}

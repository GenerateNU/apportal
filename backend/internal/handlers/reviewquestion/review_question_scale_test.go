package reviewquestion

import (
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func ip(v int) *int { return &v }

func TestResolveScale(t *testing.T) {
	lo, hi, err := resolveScale(models.QuestionScore, nil, nil)
	if err != nil || *lo != 1 || *hi != 10 {
		t.Fatalf("default scale: %v %v %v", lo, hi, err)
	}
	lo, hi, err = resolveScale(models.QuestionScore, ip(1), ip(5))
	if err != nil || *lo != 1 || *hi != 5 {
		t.Fatalf("1-5 scale: %v %v %v", lo, hi, err)
	}
	lo, hi, err = resolveScale(models.QuestionLongAnswer, nil, nil)
	if err != nil || lo != nil || hi != nil {
		t.Fatalf("non-score question: %v %v %v", lo, hi, err)
	}

	bad := []struct {
		qType    models.QuestionType
		min, max *int
	}{
		{models.QuestionLongAnswer, ip(1), ip(5)},
		{models.QuestionScore, ip(1), nil},
		{models.QuestionScore, nil, ip(5)},
		{models.QuestionScore, ip(5), ip(5)},
		{models.QuestionScore, ip(6), ip(5)},
		{models.QuestionScore, ip(-1), ip(5)},
		{models.QuestionScore, ip(0), ip(101)},
	}
	for _, c := range bad {
		_, _, err := resolveScale(c.qType, c.min, c.max)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	}
}

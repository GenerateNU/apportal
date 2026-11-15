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

func TestMergeScale(t *testing.T) {
	score, long := models.QuestionScore, models.QuestionLongAnswer
	five := models.ReviewQuestion{QuestionType: score, ScoreMin: ip(1), ScoreMax: ip(5)}
	text := models.ReviewQuestion{QuestionType: long}

	cases := []struct {
		name             string
		cur              models.ReviewQuestion
		qType            *models.QuestionType
		min, max         *int
		wantMin, wantMax *int
	}{
		{"keeps current scale", five, &score, nil, nil, ip(1), ip(5)},
		{"changes only max", five, nil, nil, ip(7), ip(1), ip(7)},
		{"to text clears scale", five, &long, nil, nil, nil, nil},
		{"text to score defaults", text, &score, nil, nil, ip(1), ip(10)},
		{"text to score with scale", text, &score, ip(0), ip(4), ip(0), ip(4)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			lo, hi, err := mergeScale(tc.cur, tc.qType, tc.min, tc.max)
			if err != nil || !sameInt(lo, tc.wantMin) || !sameInt(hi, tc.wantMax) {
				t.Fatalf("got %v %v %v", lo, hi, err)
			}
		})
	}

	_, _, err := mergeScale(text, nil, ip(1), ip(5))
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	_, _, err = mergeScale(five, nil, ip(6), nil)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

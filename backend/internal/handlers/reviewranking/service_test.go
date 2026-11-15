package reviewranking

import (
	"math"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestValidateCutoff(t *testing.T) {
	ok := []struct {
		mode  models.CutoffMode
		value float64
	}{
		{models.CutoffMinScore, -0.5},
		{models.CutoffMinScore, 1.25},
		{models.CutoffTopN, 0},
		{models.CutoffTopN, 40},
	}
	for _, c := range ok {
		if err := validateCutoff(c.mode, c.value); err != nil {
			t.Errorf("%s %v: %v", c.mode, c.value, err)
		}
	}
	bad := []struct {
		mode  models.CutoffMode
		value float64
	}{
		{"", 1},
		{"top_percent", 10},
		{models.CutoffTopN, -1},
		{models.CutoffTopN, 2.5},
		{models.CutoffMinScore, math.NaN()},
		{models.CutoffMinScore, math.Inf(1)},
	}
	for _, c := range bad {
		testutil.WantStatus(t, validateCutoff(c.mode, c.value), http.StatusUnprocessableEntity)
	}
}

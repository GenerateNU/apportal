package reviewquestion

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

const (
	defaultScoreMin = 1
	defaultScoreMax = 10
	maxScoreBound   = 100
)

func resolveScale(qType models.QuestionType, scoreMin, scoreMax *int) (*int, *int, error) {
	if qType != models.QuestionScore {
		if scoreMin != nil || scoreMax != nil {
			return nil, nil, huma.Error422UnprocessableEntity("score_min and score_max apply only to score questions")
		}
		return nil, nil, nil
	}
	if scoreMin == nil && scoreMax == nil {
		lo, hi := defaultScoreMin, defaultScoreMax
		return &lo, &hi, nil
	}
	if scoreMin == nil || scoreMax == nil {
		return nil, nil, huma.Error422UnprocessableEntity("score_min and score_max must be set together")
	}
	if *scoreMin < 0 || *scoreMax > maxScoreBound || *scoreMin >= *scoreMax {
		return nil, nil, huma.Error422UnprocessableEntity("score scale must satisfy 0 <= score_min < score_max <= 100")
	}
	return scoreMin, scoreMax, nil
}

func sameInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

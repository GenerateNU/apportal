package handlers

import (
	"github.com/GenerateNU/apportal/backend/internal/models"
	"testing"
)

func TestParseRatingFilters(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []models.InterviewRating
		hasError bool
	}{
		{"single rating", "must_hire", []models.InterviewRating{"must_hire"}, false},
		{"multiple ratings", "must_hire,great", []models.InterviewRating{"must_hire", "great"}, false},
		{"empty string", "", nil, false},
		{"whitespace padded", "  must_hire  ,  great  ", []models.InterviewRating{"must_hire", "great"}, false},
		{"all ratings", "must_hire,great,good,neutral,do_not_hire", []models.InterviewRating{"must_hire", "great", "good", "neutral", "do_not_hire"}, false},
		{"invalid rating", "invalid_rating", nil, true},
		{"mixed valid and invalid", "must_hire,invalid,great", nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseRatingFilters(tt.input)
			hasError := err != nil

			if hasError != tt.hasError {
				t.Errorf("expected error=%v, got error=%v (err: %v)", tt.hasError, hasError, err)
				return
			}

			if !tt.hasError {
				if len(result) != len(tt.expected) {
					t.Errorf("expected length=%d, got length=%d", len(tt.expected), len(result))
					return
				}

				for i := range result {
					if result[i] != tt.expected[i] {
						t.Errorf("at index %d: expected=%v, got=%v", i, tt.expected[i], result[i])
					}
				}
			}
		})
	}
}

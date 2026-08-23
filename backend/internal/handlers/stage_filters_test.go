package handlers

import (
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func TestParseStages(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []models.ApplicationStage
		hasError bool
	}{
		{"single stage", "accepted", []models.ApplicationStage{"accepted"}, false},
		{"multiple stages", "accepted,rejected", []models.ApplicationStage{"accepted", "rejected"}, false},
		{"empty string", "", nil, false},
		{"whitespace padded", "  accepted  ,  rejected  ", []models.ApplicationStage{"accepted", "rejected"}, false},
		{"empty entries skipped", "accepted,,rejected", []models.ApplicationStage{"accepted", "rejected"}, false},
		{"invalid stage", "not_a_stage", nil, true},
		{"mixed valid and invalid", "accepted,not_a_stage", nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseStages(tt.input)
			hasError := err != nil

			if hasError != tt.hasError {
				t.Errorf("expected error=%v, got error=%v (err: %v)", tt.hasError, hasError, err)
				return
			}
			if tt.hasError {
				return
			}
			if len(result) != len(tt.expected) {
				t.Errorf("expected length=%d, got length=%d", len(tt.expected), len(result))
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("at index %d: expected=%v, got=%v", i, tt.expected[i], result[i])
				}
			}
		})
	}
}

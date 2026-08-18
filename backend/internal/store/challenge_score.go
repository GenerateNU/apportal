package store

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// challengeHistoryItem mirrors one entry of the f26-technical-challenge
// server's GET /admin/lookup response ("historyItem" there) — matched field
// names, a fixed shape from another team's service.
type challengeHistoryItem struct {
	ExpeditionID string                  `json:"expeditionId"`
	Finished     bool                    `json:"finished"`
	OverallScore float64                 `json:"overallScore"`
	Metrics      models.ChallengeMetrics `json:"metrics"`
	CreatedAt    string                  `json:"createdAt"`
}

// challengeLookupResponse mirrors that endpoint's top-level response shape.
type challengeLookupResponse struct {
	Expeditions []challengeHistoryItem `json:"expeditions"`
}

// GetChallengeScore looks up an applicant's best finished expedition against
// the backend/scheduler technical challenge, via the separate
// f26-technical-challenge server's own GET /admin/lookup?email= endpoint
// (matched by email, since that's what the endpoint accepts — not NUID).
// Returns (nil, nil) — not an error — when the token isn't configured, the
// applicant isn't registered there, or they have no finished expedition yet
// (e.g. they took the frontend challenge instead). Any other failure (bad
// token, network error, unexpected response) is a real error.
func (s *Store) GetChallengeScore(ctx context.Context, email string) (*models.ChallengeScore, error) {
	if s.challengeAdminToken == "" || s.challengeServerURL == "" {
		return nil, nil
	}

	reqURL := fmt.Sprintf("%s/admin/lookup?email=%s", s.challengeServerURL, url.QueryEscape(email))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Admin-Token", s.challengeAdminToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("challenge server lookup: unexpected status %d", resp.StatusCode)
	}

	var parsed challengeLookupResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	var best *challengeHistoryItem
	for i := range parsed.Expeditions {
		item := &parsed.Expeditions[i]
		if !item.Finished {
			continue
		}
		if best == nil || item.OverallScore > best.OverallScore {
			best = item
		}
	}
	if best == nil {
		return nil, nil
	}

	attempts := 0
	for _, item := range parsed.Expeditions {
		if item.Finished {
			attempts++
		}
	}

	finishedAt, err := parseChallengeTime(best.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &models.ChallengeScore{
		ExpeditionID: best.ExpeditionID,
		OverallScore: best.OverallScore,
		Metrics:      best.Metrics,
		AttemptCount: attempts,
		FinishedAt:   finishedAt,
	}, nil
}

// parseChallengeTime parses the challenge server's RFC3339 createdAt string
// (Go's default time.Time JSON encoding) into a time.Time.
func parseChallengeTime(s string) (time.Time, error) {
	return time.Parse(time.RFC3339, s)
}

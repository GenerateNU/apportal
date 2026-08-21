package models

import "time"

// ChallengeMetrics mirrors the f26-technical-challenge server's own Metrics
// struct exactly (field names and all) — it's a fixed, well-documented shape
// from another team's service, not free-form JSONB we own, so it gets a real
// Go type instead of the json.RawMessage passthrough used elsewhere in this
// codebase.
type ChallengeMetrics struct {
	Throughput      float64 `json:"throughput"`
	GateUtilization float64 `json:"gateUtilization"`
	ArrivalSuccess  float64 `json:"arrivalSuccess"`
	Fairness        float64 `json:"fairness"`
	Reliability     float64 `json:"reliability"`
	SLACompliance   float64 `json:"slaCompliance"`
}

// ChallengeAttempt is one finished expedition, used to let a reviewer browse
// an applicant's full attempt history rather than just their best score.
type ChallengeAttempt struct {
	ExpeditionID string           `json:"expedition_id"`
	OverallScore float64          `json:"overall_score"`
	Metrics      ChallengeMetrics `json:"metrics"`
	FinishedAt   time.Time        `json:"finished_at"`
}

// ChallengeScore is an applicant's best finished expedition against the
// backend/scheduler technical challenge, read from that server's own
// database (matched by NUID) — nil from GetChallengeScore when the applicant
// has no finished expedition there (they may have done the frontend
// challenge instead, or not started). Attempts holds every finished
// expedition (newest first), for reviewers who want to see the applicant's
// progress rather than just the best run.
type ChallengeScore struct {
	ExpeditionID string             `json:"expedition_id"`
	OverallScore float64            `json:"overall_score"`
	Metrics      ChallengeMetrics   `json:"metrics"`
	AttemptCount int                `json:"attempt_count"`
	FinishedAt   time.Time          `json:"finished_at"`
	Attempts     []ChallengeAttempt `json:"attempts"`
}

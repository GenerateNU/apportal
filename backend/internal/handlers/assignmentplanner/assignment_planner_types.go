package assignmentplanner

import (
	"github.com/GenerateNU/apportal/backend/internal/assign"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// PlanTeam is a group of leads who review together, named by the chief.
type PlanTeam struct {
	Name      string   `json:"name" doc:"Display name for the team"`
	LeadNUIDs []string `json:"lead_nuids" minItems:"1" doc:"NUIDs of the leads on this team"`
}

// --- capacity ---
type CapacityInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role     models.Role `json:"role" doc:"Applicant role whose pool is being planned"`
		Teams    []PlanTeam  `json:"teams"`
		Coverage int         `json:"coverage" minimum:"1" doc:"How many distinct leads should review each application"`
		// ExcludedApplicationIDs are left out of the pool for this call only —
		// supplied per request rather than stored, same as Teams.
		ExcludedApplicationIDs []string `json:"excluded_application_ids,omitempty"`
	}
}

type CapacityOutput struct {
	Body assign.Capacity
}

// --- preview ---
type PreviewPlanInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role         models.Role    `json:"role"`
		Teams        []PlanTeam     `json:"teams"`
		Coverage     int            `json:"coverage" minimum:"1"`
		Cap          int            `json:"cap" minimum:"1" doc:"Maximum applications per lead"`
		CapOverrides map[string]int `json:"cap_overrides,omitempty" doc:"Per-lead cap overrides, keyed by NUID"`
		// ExcludedApplicationIDs are left out of the pool for this call only —
		// supplied per request rather than stored, same as Teams. Commit
		// re-reads this from its own request body, so an excluded application
		// stays excluded only for as long as the chief keeps sending its ID.
		ExcludedApplicationIDs []string `json:"excluded_application_ids,omitempty"`
	}
}

// PlannedApplication identifies an application in a preview, with enough detail
// to recognise the applicant without a second lookup.
type PlannedApplication struct {
	ApplicationID string `json:"application_id"`
	ApplicantNUID string `json:"applicant_nuid"`
	FullName      string `json:"full_name"`
	Email         string `json:"email"`
	// AlreadyAssigned marks a review this lead was already assigned, as opposed
	// to one this plan is proposing to add.
	AlreadyAssigned bool `json:"already_assigned"`
}

// PlannedLead is one lead's proposed review queue.
type PlannedLead struct {
	LeadNUID     string               `json:"lead_nuid"`
	FullName     string               `json:"full_name"`
	TeamName     string               `json:"team_name"`
	Cap          int                  `json:"cap"`
	Existing     int                  `json:"existing"`
	Added        int                  `json:"added"`
	Total        int                  `json:"total"`
	Applications []PlannedApplication `json:"applications"`
}

// AssignmentPlanPreview is the whole proposal: per-lead queues plus the
// coverage picture across the pool.
type AssignmentPlanPreview struct {
	PoolSize int           `json:"pool_size"`
	Coverage int           `json:"coverage"`
	Leads    []PlannedLead `json:"leads"`
	// CoverageCounts maps a reviewer count to how many applications have
	// exactly that many reviewers under the plan.
	CoverageCounts map[string]int `json:"coverage_counts"`
	// UnderCovered lists applications the plan could not fully cover.
	UnderCovered []PlannedApplication `json:"under_covered"`
	Warnings     []string             `json:"warnings"`
	// TotalAdded is how many assignments would be created on commit.
	TotalAdded int `json:"total_added"`
}

type PreviewPlanOutput struct {
	Body AssignmentPlanPreview
}

// plannedRun bundles a computed plan with the context needed to describe or
// persist it, so preview and commit can share one planning path.
type plannedRun struct {
	plan     assign.Plan
	prior    []assign.Pair
	byID     map[string]models.ApplicationSummary
	appIDs   []string
	coverage int
}

// --- commit ---

// CommitPlanOutput reports what was actually written, alongside the plan as it
// stood at write time so the UI can show the committed result rather than the
// preview it was built from.
type CommitPlanOutput struct {
	Body struct {
		// Created is how many assignments this commit inserted. Re-committing an
		// unchanged plan reports 0 — the rows already exist.
		Created int                   `json:"created"`
		Plan    AssignmentPlanPreview `json:"plan"`
	}
}

// --- pool ---
type PoolInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

// PoolApplicant identifies one application in the pool, with enough detail to
// recognise the applicant without a second lookup — used by the chief to pick
// which applicants to exclude before planning.
type PoolApplicant struct {
	ApplicationID string `json:"application_id"`
	FullName      string `json:"full_name"`
	Email         string `json:"email"`
}

type PoolOutput struct {
	Body struct {
		PoolSize int `json:"pool_size"`
		// LeadCount is how many leads exist to draw teams from.
		LeadCount int `json:"lead_count"`
		// Applicants is the full pool, unfiltered by any exclusion — the chief
		// checks some of these off to exclude them from capacity/preview/commit.
		Applicants []PoolApplicant `json:"applicants"`
	}
}

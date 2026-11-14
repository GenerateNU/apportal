package reviewscoring

import "github.com/GenerateNU/apportal/backend/internal/models"

type Rubric struct {
	Rubric     models.ReviewRubric           `json:"rubric"`
	ScoreMin   int                           `json:"score_min"`
	ScoreMax   int                           `json:"score_max"`
	Categories []models.ReviewRubricCategory `json:"categories"`
	Locked     bool                          `json:"locked" doc:"True once any lead has rated an answer this cycle; the rubric can no longer change"`
}

type RubricOutput struct {
	Body Rubric
}

type CategoryBody struct {
	Label  string `json:"label" minLength:"1"`
	Points int    `json:"points"`
}

type UpdateRubricInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Rubric     models.ReviewRubric `json:"rubric"`
		ScoreMin   int                 `json:"score_min" minimum:"0" maximum:"100"`
		ScoreMax   int                 `json:"score_max" minimum:"1" maximum:"100"`
		Categories []CategoryBody      `json:"categories" maxItems:"20"`
	}
}

type RubricWrite struct {
	Rubric     models.ReviewRubric
	ScoreMin   int
	ScoreMax   int
	Categories []CategoryBody
}

type RoleQueryInput struct {
	ID   string      `path:"id" doc:"Cycle ID"`
	Role models.Role `query:"role" doc:"Applicant role"`
}

type SettingsOutput struct {
	Body models.ReviewScoringSetting
}

type UpdateSettingsInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Body struct {
		Role      models.Role `json:"role"`
		Normalize bool        `json:"normalize"`
		Cutoff    *float64    `json:"cutoff,omitempty" doc:"Applicants at or above this score clear the cutoff; omit for no cutoff"`
	}
}

type ApplicationScore struct {
	ApplicationID string  `json:"application_id"`
	Raw           float64 `json:"raw" doc:"Average of the submitted reviews, on the rubric's range"`
	Normalized    float64 `json:"normalized" doc:"Same, after z-scoring each reviewer against their own reviews"`
	Score         float64 `json:"score" doc:"Normalized when the settings turn normalizing on, otherwise raw"`
	Reviews       int     `json:"reviews"`
	AboveCutoff   *bool   `json:"above_cutoff,omitempty" doc:"Omitted when no cutoff is set"`
}

type ScoresOutput struct {
	Body struct {
		Min       float64            `json:"min"`
		Max       float64            `json:"max"`
		Normalize bool               `json:"normalize"`
		Cutoff    *float64           `json:"cutoff,omitempty"`
		Scores    []ApplicationScore `json:"scores"`
	}
}

type ratingRow struct {
	ApplicationID string
	ReviewerNUID  string
	Weight        float64
	Score         *int
	Points        *int
}

package workflow

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type Page string

const (
	PagePositions          Page = "positions"
	PageTeam               Page = "team"
	PageApplicationForms   Page = "application_forms"
	PageReviewForms        Page = "review_forms"
	PageApplicants         Page = "applicants"
	PageAssignReviewers    Page = "assign_reviewers"
	PageReviewProgress     Page = "review_progress"
	PageShortlist          Page = "shortlist"
	PageInterviewScript    Page = "interview_script"
	PageAssignInterviewers Page = "assign_interviewers"
	PageInterviewProgress  Page = "interview_progress"
	PagePreferenceLists    Page = "preference_lists"
	PageDraft              Page = "draft"
	PageFeedback           Page = "feedback"
	PageWrapUp             Page = "wrap_up"
)

var allPages = []Page{PagePositions, PageTeam, PageApplicationForms, PageReviewForms, PageApplicants,
	PageAssignReviewers, PageReviewProgress, PageShortlist, PageInterviewScript, PageAssignInterviewers,
	PageInterviewProgress, PagePreferenceLists, PageDraft, PageFeedback, PageWrapUp}

func (Page) Schema(huma.Registry) *huma.Schema {
	enum := make([]any, len(allPages))
	for i, p := range allPages {
		enum[i] = string(p)
	}
	return &huma.Schema{Type: huma.TypeString, Enum: enum}
}

// PhaseSetup is the phase before the first step: positions and the recruitment team.
const PhaseSetup = "setup"

var stepPages = map[models.Step][]Page{
	models.StepApplications: {PageApplicationForms, PageReviewForms, PageApplicants},
	models.StepReviews:      {PageAssignReviewers, PageReviewProgress, PageShortlist},
	models.StepInterviews:   {PageInterviewScript, PageAssignInterviewers, PageInterviewProgress},
	models.StepDecisions:    {PagePreferenceLists, PageDraft, PageWrapUp},
	models.StepFeedback:     {PageFeedback, PageWrapUp},
}

type PageView struct {
	Page         Page    `json:"page"`
	LockedReason *string `json:"locked_reason,omitempty"`
}

// PhaseView is one entry of the cycle's navigation; what is locked, and why, is decided here.
type PhaseView struct {
	Key            string     `json:"key" doc:"setup, or a step"`
	Label          string     `json:"label"`
	Status         Status     `json:"status"`
	LockedReason   *string    `json:"locked_reason,omitempty"`
	ApplicantCount int        `json:"applicant_count"`
	Pages          []PageView `json:"pages"`
}

func reason(s string) *string { return &s }

func (f *CycleState) Phases() []PhaseView {
	setup := PhaseView{Key: PhaseSetup, Label: "Setup", Status: StatusOpen, Pages: []PageView{{Page: PagePositions}, {Page: PageTeam}}}
	if len(f.Openings) == 0 {
		setup.Pages[1].LockedReason = reason("Add a position first.")
	}
	if f.SetUp() {
		setup.Status = StatusDone
	}
	out := []PhaseView{setup}
	for _, s := range f.EnabledSteps() {
		p := PhaseView{Key: string(s), Label: Label(s), Status: f.StepStatus(s), ApplicantCount: f.StepCount(s), Pages: []PageView{}}
		if p.Status == StatusLocked {
			p.LockedReason = f.lockedBecause()
		}
		for _, pg := range stepPages[s] {
			v := PageView{Page: pg, LockedReason: p.LockedReason}
			if pg == PageApplicants && v.LockedReason == nil && !f.StartedAnywhere(models.StepApplications) {
				v.LockedReason = reason("Opens once you release an application.")
			}
			p.Pages = append(p.Pages, v)
		}
		out = append(out, p)
	}
	return out
}

func (f *CycleState) lockedBecause() *string {
	switch {
	case len(f.Openings) == 0:
		return reason("Add a position first.")
	case !f.HasTeam:
		return reason("Add your recruitment team first.")
	}
	if cur, ok := f.Current(); ok {
		return reason("Finish " + Label(cur) + " first.")
	}
	return nil
}

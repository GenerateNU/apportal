package access

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

// CycleAction is something done to a cycle as a whole.
type CycleAction int

const (
	ReviewCycle CycleAction = iota // read its setup and work its queues
	ManageCycle                    // set it up and run the pipeline
	cycleActionCount
)

// ApplicationAction is something done to one application.
type ApplicationAction int

const (
	ViewApplication ApplicationAction = iota
	EditOwnApplication
	ReviewApplication // read its reviews and write your own
	ManageApplication // chief work: assignments, chief reviews
	ChangeStage
	EditInterview       // schedule and rating
	WriteInterviewNotes // write-up, links, submitting
	OverrideInterviewRating
	SubmitRecordingReview
	WriteDecisionFeedback
	EditDecisionLetter
	applicationActionCount
)

type cyclePolicy struct {
	level  Level
	denied string
}

var cyclePolicies = map[CycleAction]cyclePolicy{
	ReviewCycle: {Review, "staff role required on this cycle"},
	ManageCycle: {Manage, "chief role required on this cycle"},
}

// assignment is a per-application job someone was given.
type assignment int

const (
	unassigned assignment = iota
	interviewer
	recordingReviewer
)

// applicationPolicy allows the action to anyone with level on the cycle, the
// applicant when owner is set, and staff given the assigned job.
type applicationPolicy struct {
	level    Level
	owner    bool
	assigned assignment
	denied   string
}

var applicationPolicies = map[ApplicationAction]applicationPolicy{
	ViewApplication:         {level: Review, owner: true},
	EditOwnApplication:      {owner: true, denied: "only the applicant may edit their application"},
	ReviewApplication:       {level: Review, denied: "staff role required on this cycle"},
	ManageApplication:       {level: Manage, denied: "chief role required on this cycle"},
	ChangeStage:             {level: Manage, denied: "chief role required to change an application's stage"},
	EditInterview:           {level: Manage, assigned: interviewer, denied: "only an assigned interviewer may edit this interview"},
	WriteInterviewNotes:     {assigned: interviewer, denied: "only an assigned interviewer may edit the write-up or links, or submit"},
	OverrideInterviewRating: {level: Manage, denied: "only a chief may override the interview rating"},
	SubmitRecordingReview:   {assigned: recordingReviewer, denied: "only an assigned recording reviewer may submit this review"},
	WriteDecisionFeedback:   {level: Manage, assigned: interviewer, denied: "only this applicant's interviewer or a chief can write their decision"},
	EditDecisionLetter:      {level: Manage, denied: "chief role required to change the kind, override the message, or mark it sent"},
}

// CycleAccess is what the caller may do with one cycle.
type CycleAccess struct {
	level Level
	admin bool
	staff models.CycleStaffRole
}

func (a CycleAccess) Admin() bool { return a.admin && a.level != None }

func (a CycleAccess) Staff() models.CycleStaffRole {
	if a.level == None {
		return ""
	}
	return a.staff
}

// CycleAccessAt and ApplicationAccessAt let other packages' tests stand in for a Checker.
func CycleAccessAt(level Level) CycleAccess {
	return CycleAccess{level: level}
}

func ApplicationAccessAt(level Level, owner bool) ApplicationAccess {
	return ApplicationAccess{level: level, owner: owner}
}

func (a CycleAccess) Allows(action CycleAction) bool {
	return a.level >= cyclePolicies[action].level
}

// Can 404s on a cycle the caller can't see, so its existence doesn't leak, and
// 403s when they can see it but the action needs more.
func (a CycleAccess) Can(action CycleAction) error {
	if a.Allows(action) {
		return nil
	}
	if a.level == None {
		return notFound()
	}
	return huma.Error403Forbidden(cyclePolicies[action].denied)
}

// ApplicationAccess is what the caller may do with one application.
type ApplicationAccess struct {
	level             Level // on the application's cycle
	owner             bool
	draft             bool
	interviewer       bool
	recordingReviewer bool
}

func (a ApplicationAccess) Allows(action ApplicationAction) bool {
	p := applicationPolicies[action]
	if a.owner && p.owner {
		return true
	}
	if a.hidden() {
		return false
	}
	if p.level != None && a.level >= p.level {
		return true
	}
	return a.level >= Review && a.has(p.assigned)
}

// Can 404s when the caller can't see the application at all, else 403s.
func (a ApplicationAccess) Can(action ApplicationAction) error {
	if a.Allows(action) {
		return nil
	}
	if a.hidden() {
		return notFound()
	}
	return huma.Error403Forbidden(applicationPolicies[action].denied)
}

// hidden: drafts are private to their owner, and so is anything on a cycle the
// caller can't see.
func (a ApplicationAccess) hidden() bool {
	return !a.owner && (a.level == None || a.draft)
}

func (a ApplicationAccess) has(job assignment) bool {
	switch job {
	case interviewer:
		return a.interviewer
	case recordingReviewer:
		return a.recordingReviewer
	}
	return false
}

func notFound() error {
	return huma.Error404NotFound("not found")
}

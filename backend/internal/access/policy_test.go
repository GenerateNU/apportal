package access

import (
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestEveryActionHasAPolicy(t *testing.T) {
	for a := ApplicationAction(0); a < applicationActionCount; a++ {
		if _, ok := applicationPolicies[a]; !ok {
			t.Errorf("application action %d has no policy", a)
		}
	}
	for a := CycleAction(0); a < cycleActionCount; a++ {
		if _, ok := cyclePolicies[a]; !ok {
			t.Errorf("cycle action %d has no policy", a)
		}
	}
}

func TestApplicationPolicies(t *testing.T) {
	personas := []struct {
		name    string
		access  ApplicationAccess
		allowed []ApplicationAction
	}{
		{"stranger", ApplicationAccess{}, nil},
		{"owner", ApplicationAccess{owner: true},
			[]ApplicationAction{ViewApplication, EditOwnApplication}},
		{"owner of a draft", ApplicationAccess{owner: true, draft: true},
			[]ApplicationAction{ViewApplication, EditOwnApplication}},
		{"lead", ApplicationAccess{level: Review},
			[]ApplicationAction{ViewApplication, ReviewApplication}},
		{"lead who interviewed them", ApplicationAccess{level: Review, interviewer: true},
			[]ApplicationAction{ViewApplication, ReviewApplication, EditInterview, WriteInterviewNotes, WriteDecisionFeedback}},
		{"lead reviewing the recording", ApplicationAccess{level: Review, recordingReviewer: true},
			[]ApplicationAction{ViewApplication, ReviewApplication, SubmitRecordingReview}},
		{"lead assigned to review them", ApplicationAccess{level: Review, leadReviewer: true},
			[]ApplicationAction{ViewApplication, ReviewApplication, WriteReview}},
		{"chief", ApplicationAccess{level: Manage},
			[]ApplicationAction{ViewApplication, ReviewApplication, ManageApplication, ChangeStage, EditInterview,
				OverrideInterviewRating, WriteDecisionFeedback, EditDecisionLetter, WriteReview}},
		// Drafts are private to the owner, whoever else is asking.
		{"chief on a draft", ApplicationAccess{level: Manage, draft: true}, nil},
		// An assignment means nothing once the cycle is hidden from them.
		{"interviewer no longer on staff", ApplicationAccess{interviewer: true, recordingReviewer: true, leadReviewer: true}, nil},
	}
	for _, p := range personas {
		allowed := map[ApplicationAction]bool{}
		for _, a := range p.allowed {
			allowed[a] = true
		}
		for a := ApplicationAction(0); a < applicationActionCount; a++ {
			if got := p.access.Allows(a); got != allowed[a] {
				t.Errorf("%s, action %d: Allows = %v, want %v", p.name, a, got, allowed[a])
			}
			if err := p.access.Can(a); (err == nil) != allowed[a] {
				t.Errorf("%s, action %d: Can = %v, want allowed=%v", p.name, a, err, allowed[a])
			}
		}
	}
}

func TestApplicationDenials(t *testing.T) {
	cases := []struct {
		name   string
		access ApplicationAccess
		action ApplicationAction
		code   int
	}{
		{"stranger can't tell it exists", ApplicationAccess{}, ViewApplication, http.StatusNotFound},
		{"staff can't tell a draft exists", ApplicationAccess{level: Manage, draft: true}, ViewApplication, http.StatusNotFound},
		{"owner asking for staff work", ApplicationAccess{owner: true}, ReviewApplication, http.StatusForbidden},
		{"lead changing the stage", ApplicationAccess{level: Review}, ChangeStage, http.StatusForbidden},
		{"lead editing someone's application", ApplicationAccess{level: Review}, EditOwnApplication, http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.WantStatus(t, tc.access.Can(tc.action), tc.code)
		})
	}
}

func TestCyclePolicies(t *testing.T) {
	cases := []struct {
		level  Level
		action CycleAction
		code   int // 0 means allowed
	}{
		{None, ReviewCycle, http.StatusNotFound},
		{None, ManageCycle, http.StatusNotFound},
		{Review, ReviewCycle, 0},
		{Review, ManageCycle, http.StatusForbidden},
		{Manage, ReviewCycle, 0},
		{Manage, ManageCycle, 0},
	}
	for _, tc := range cases {
		a := CycleAccess{level: tc.level}
		err := a.Can(tc.action)
		if tc.code == 0 {
			if err != nil || !a.Allows(tc.action) {
				t.Errorf("level %d, action %d: want allowed, got %v", tc.level, tc.action, err)
			}
			continue
		}
		testutil.WantStatus(t, err, tc.code)
		if a.Allows(tc.action) {
			t.Errorf("level %d, action %d: Allows = true", tc.level, tc.action)
		}
	}
}

package workflow

import (
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

func pageLock(ps []PhaseView, key string, page Page) (string, bool) {
	for _, p := range ps {
		if p.Key != key {
			continue
		}
		for _, v := range p.Pages {
			if v.Page == page {
				if v.LockedReason == nil {
					return "", true
				}
				return *v.LockedReason, true
			}
		}
	}
	return "", false
}

func TestPhasesLockUntilSetUp(t *testing.T) {
	f := NewCycleState("c1")
	ps := f.Phases(now)
	if ps[0].Key != PhaseSetup || ps[0].Status != StatusOpen {
		t.Fatalf("setup first and open: %+v", ps[0])
	}
	if r, _ := pageLock(ps, PhaseSetup, PageTeam); r != "Add a position first." {
		t.Fatalf("team without a position: %q", r)
	}
	for _, p := range ps[1:] {
		if p.Status != StatusLocked || p.LockedReason == nil || *p.LockedReason != "Add a position first." {
			t.Fatalf("%s should wait on a position: %+v", p.Key, p)
		}
	}

	f.Openings = []Opening{{RoleID: swe, Name: "Software Engineer"}}
	if r, _ := pageLock(f.Phases(now), string(models.StepApplications), PageApplicationForms); r != "Add your recruitment team first." {
		t.Fatalf("forms without a team: %q", r)
	}

	f.HasTeam = true
	ps = f.Phases(now)
	if ps[0].Status != StatusDone {
		t.Fatal("setup is done with a position and a team")
	}
	if r, ok := pageLock(ps, string(models.StepApplications), PageApplicationForms); !ok || r != "" {
		t.Fatalf("forms open once set up: %q", r)
	}
	if r, _ := pageLock(ps, string(models.StepApplications), PageApplicants); r != "Opens once you release an application." {
		t.Fatalf("applicants before a release: %q", r)
	}
	if r, _ := pageLock(ps, string(models.StepReviews), PageShortlist); r != "Finish Applications first." {
		t.Fatalf("reviews before applications are done: %q", r)
	}
	f.SetRelease(swe, models.StepApplications, past)
	if r, _ := pageLock(f.Phases(now), string(models.StepApplications), PageApplicants); r != "" {
		t.Fatalf("applicants once released: %q", r)
	}

	f.CompletedAt[models.StepApplications] = &past
	reviews := string(models.StepReviews)
	f.Reviews = ReviewProgress{Assigned: 2, Submitted: 1}
	if r, _ := pageLock(f.Phases(now), reviews, PageReviewProgress); r != "Opens once you release reviews." {
		t.Fatalf("progress before reviews are released: %q", r)
	}
	if r, _ := pageLock(f.Phases(now), reviews, PageShortlist); r == "" {
		t.Fatal("shortlist waits on the last review")
	}
	f.SetRelease(swe, models.StepReviews, past)
	if r, _ := pageLock(f.Phases(now), reviews, PageReviewProgress); r != "" {
		t.Fatalf("progress once reviews are released: %q", r)
	}
	f.SetDeadline(swe, models.StepReviews, Deadline{Kind: models.KindReviewer, DueAt: past})
	if r, _ := pageLock(f.Phases(now), reviews, PageShortlist); r != "" {
		t.Fatalf("shortlist once the review deadline passes: %q", r)
	}
	f.Deadlines = map[key]map[models.StepKind]Deadline{}
	f.Reviews.Submitted = 2
	if r, _ := pageLock(f.Phases(now), reviews, PageShortlist); r != "" {
		t.Fatalf("shortlist once every review is in: %q", r)
	}

	f.CompletedAt[models.StepReviews] = &past
	interviews := string(models.StepInterviews)
	if r, _ := pageLock(f.Phases(now), interviews, PageInterviewProgress); r != "Opens once you release interviews." {
		t.Fatalf("interview progress before release: %q", r)
	}
	f.SetRelease(swe, models.StepInterviews, past)
	if r, _ := pageLock(f.Phases(now), interviews, PageInterviewProgress); r != "" {
		t.Fatalf("interview progress once released: %q", r)
	}

	f.CompletedAt[models.StepInterviews] = &past
	decisions := string(models.StepDecisions)
	if r, _ := pageLock(f.Phases(now), decisions, PageDraft); r != "Opens once the preference list deadline passes." {
		t.Fatalf("draft before the deadline: %q", r)
	}
	f.SetDeadline(swe, models.StepDecisions, Deadline{Kind: models.KindPreferenceList, DueAt: past})
	if r, _ := pageLock(f.Phases(now), decisions, PageDraft); r != "" {
		t.Fatalf("draft once preference lists close: %q", r)
	}

	f.CompletedAt[models.StepDecisions] = &past
	feedback := string(models.StepFeedback)
	if r, _ := pageLock(f.Phases(now), feedback, PageFeedback); r != "Opens once a chief opens Feedback." {
		t.Fatalf("feedback before a chief opens it: %q", r)
	}
	if err := f.ReleaseBlock(swe, models.StepFeedback, now); err != nil {
		t.Fatalf("feedback can be opened once decisions are done: %v", err)
	}
	f.SetRelease(swe, models.StepFeedback, now)
	if r, _ := pageLock(f.Phases(now), feedback, PageFeedback); r != "" {
		t.Fatalf("feedback once opened: %q", r)
	}
}

func TestClosedPreferenceListsCannotMove(t *testing.T) {
	f := NewCycleState("c1")
	f.Openings = []Opening{{RoleID: swe, Name: "Software Engineer"}}
	if err := f.listsClosedBlock(swe, models.StepDecisions, models.KindPreferenceList, now); err != nil {
		t.Fatalf("no deadline yet: %v", err)
	}
	f.SetDeadline(swe, models.StepDecisions, Deadline{Kind: models.KindPreferenceList, DueAt: now.Add(time.Hour)})
	if err := f.listsClosedBlock(swe, models.StepDecisions, models.KindPreferenceList, now); err != nil {
		t.Fatalf("an open deadline can move: %v", err)
	}
	f.SetDeadline(swe, models.StepDecisions, Deadline{Kind: models.KindPreferenceList, DueAt: past})
	if err := f.listsClosedBlock(swe, models.StepDecisions, models.KindPreferenceList, now); err == nil {
		t.Fatal("a passed deadline is locked")
	}
	if err := f.listsClosedBlock(swe, models.StepReviews, models.KindReviewer, now); err != nil {
		t.Fatalf("other deadlines are unaffected: %v", err)
	}
}

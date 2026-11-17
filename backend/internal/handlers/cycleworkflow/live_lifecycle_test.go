package cycleworkflow

import (
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type unlocks struct {
	chief map[workflow.Page]bool
	lead  map[workflow.TaskKind]workflow.Status
}

func (f *fixture) seen(a middleware.Actor) workflow.Overview {
	f.t.Helper()
	ov, err := f.s.workflow.Overview(f.as(a), f.cycleA)
	f.must(err)
	return ov
}

func (f *fixture) unlocks() unlocks {
	u := unlocks{chief: map[workflow.Page]bool{}, lead: map[workflow.TaskKind]workflow.Status{}}
	for _, p := range f.seen(f.chiefA).Phases {
		for _, pg := range p.Pages {
			u.chief[pg.Page] = pg.LockedReason == nil
		}
	}
	for _, t := range f.seen(f.leadA).Tasks {
		if t.RoleID == nil || *t.RoleID == f.roleA {
			u.lead[t.Kind] = t.Status
		}
	}
	return u
}

func (u unlocks) String() string {
	var open []string
	for pg, ok := range u.chief {
		if ok {
			open = append(open, string(pg))
		}
	}
	sort.Strings(open)
	var lead []string
	for _, k := range []workflow.TaskKind{workflow.TaskReview, workflow.TaskInterview, workflow.TaskRecordingReview,
		workflow.TaskPreferenceList, workflow.TaskDraft, workflow.TaskFeedback} {
		if s, ok := u.lead[k]; ok {
			lead = append(lead, fmt.Sprintf("%s=%s", k, s))
		}
	}
	return fmt.Sprintf("chief opens [%s]\n    lead sees  [%s]", strings.Join(open, " "), strings.Join(lead, " "))
}

// The whole cycle for one opening, driven through the real services. After
// each step it checks what the chief and the lead can open.
func TestLiveLifecycleUnlocks(t *testing.T) {
	f := newFixture(t)
	app, other := f.apps[0], f.apps[1]
	step := 0
	check := func(label string, chief map[workflow.Page]bool, lead map[workflow.TaskKind]workflow.Status) {
		t.Helper()
		step++
		u := f.unlocks()
		t.Logf("%2d. %s\n    %s", step, label, u)
		for pg, want := range chief {
			if u.chief[pg] != want {
				t.Errorf("step %d (%s): chief %s open=%v, want %v", step, label, pg, u.chief[pg], want)
			}
		}
		for k, want := range lead {
			if got, ok := u.lead[k]; !ok && want != "" || ok && got != want {
				t.Errorf("step %d (%s): lead %s=%q, want %q", step, label, k, got, want)
			}
		}
	}
	locked, open, done := workflow.StatusLocked, workflow.StatusOpen, workflow.StatusDone

	f.openApplications()
	check("Applications released", map[workflow.Page]bool{
		workflow.PageApplicants: true, workflow.PageReviewProgress: false, workflow.PageShortlist: false,
	}, nil)

	f.assignReviewer(app)
	f.assignReviewer(other)
	check("Reviewers assigned, reviews not released", map[workflow.Page]bool{
		workflow.PageReviewProgress: false,
	}, map[workflow.TaskKind]workflow.Status{workflow.TaskReview: locked})

	f.deadline(f.roleA, models.StepApplications, models.KindApplicant, f.now.Add(-time.Minute))
	_, err := f.advance(f.as(f.chiefA), models.StepApplications, &f.roleA, app, other)
	f.must(err)
	f.must(f.s.workflow.Complete(f.confirmed(f.chiefA), f.cycleA, models.StepApplications))
	f.deadline(f.roleA, models.StepReviews, models.KindReviewer, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepReviews)
	check("Reviews released", map[workflow.Page]bool{
		workflow.PageReviewProgress: true, workflow.PageShortlist: false,
	}, map[workflow.TaskKind]workflow.Status{workflow.TaskReview: open, workflow.TaskInterview: ""})

	f.exec("INSERT INTO written_reviews (application_id, reviewer_nuid, submitted_at) VALUES (?, ?, now()), (?, ?, now())",
		app, f.leadA.NUID, other, f.leadA.NUID)
	check("Lead submits both reviews", map[workflow.Page]bool{workflow.PageShortlist: true},
		map[workflow.TaskKind]workflow.Status{workflow.TaskReview: done})

	_, err = f.advance(f.confirmed(f.chiefA), models.StepReviews, &f.roleA, app, other)
	f.must(err)
	f.must(f.s.workflow.Complete(f.confirmed(f.chiefA), f.cycleA, models.StepReviews))
	iv := map[string]string{}
	for _, a := range []string{app, other} {
		var id string
		f.must(f.db.Raw("INSERT INTO interviews (application_id) VALUES (?) RETURNING id", a).Scan(&id).Error)
		iv[a] = id
		f.exec("INSERT INTO interviewers (interview_id, interviewer_nuid, assigned_by) VALUES (?, ?, ?)", id, f.leadA.NUID, f.chiefA.NUID)
		f.exec("INSERT INTO interview_reviewers (interview_id, reviewer_nuid, assigned_by) VALUES (?, ?, ?)", id, f.leadA.NUID, f.chiefA.NUID)
	}
	check("Shortlisted, interviewers and recording reviewers assigned, not released", map[workflow.Page]bool{
		workflow.PageAssignInterviewers: true, workflow.PageInterviewProgress: false,
	}, map[workflow.TaskKind]workflow.Status{workflow.TaskInterview: locked, workflow.TaskRecordingReview: locked})

	f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(time.Hour))
	f.release(f.roleA, models.StepInterviews)
	check("Interviews released", map[workflow.Page]bool{workflow.PageInterviewProgress: true},
		map[workflow.TaskKind]workflow.Status{workflow.TaskInterview: open, workflow.TaskRecordingReview: open,
			workflow.TaskPreferenceList: ""})

	f.exec("UPDATE interviews SET submitted_at = now() WHERE id IN ?", []string{iv[app], iv[other]})
	f.exec("UPDATE interview_reviewers SET writeup_submitted_at = now() WHERE interview_id IN ?", []string{iv[app], iv[other]})
	var list string
	f.must(f.db.Raw("INSERT INTO preference_lists (cycle_id, name, created_by) VALUES (?, 'Team', ?) RETURNING id", f.cycleA, f.chiefA.NUID).Scan(&list).Error)
	f.exec("INSERT INTO preference_list_members (preference_list_id, lead_nuid, added_by) VALUES (?, ?, ?)", list, f.leadA.NUID, f.chiefA.NUID)
	check("Interviews and recordings submitted, lead put on a team", map[workflow.Page]bool{workflow.PagePreferenceLists: false},
		map[workflow.TaskKind]workflow.Status{workflow.TaskInterview: done, workflow.TaskRecordingReview: done,
			workflow.TaskPreferenceList: locked})

	f.deadline(f.roleA, models.StepInterviews, models.KindInterviewer, f.now.Add(-time.Minute))
	_, err = f.advance(f.confirmed(f.chiefA), models.StepInterviews, &f.roleA, app, other)
	f.must(err)
	f.must(f.s.workflow.Complete(f.confirmed(f.chiefA), f.cycleA, models.StepInterviews))
	check("Both advanced to Decisions", map[workflow.Page]bool{
		workflow.PagePreferenceLists: true, workflow.PageDraft: false,
	}, map[workflow.TaskKind]workflow.Status{workflow.TaskPreferenceList: open, workflow.TaskDraft: ""})

	f.exec("UPDATE preference_lists SET status = 'submitted', submitted_at = now() WHERE id = ?", list)
	check("Team submits its list", map[workflow.Page]bool{workflow.PageDraft: false},
		map[workflow.TaskKind]workflow.Status{workflow.TaskPreferenceList: done})

	for _, r := range []string{f.roleA, f.roleA2} {
		f.deadline(r, models.StepDecisions, models.KindPreferenceList, f.now.Add(-time.Minute))
	}
	check("Preference list deadline passes", map[workflow.Page]bool{workflow.PageDraft: true},
		map[workflow.TaskKind]workflow.Status{workflow.TaskDraft: ""})

	var board string
	f.must(f.db.Raw("INSERT INTO drafts (cycle_id, role_id, status, created_by) VALUES (?, ?, 'active', ?) RETURNING id", f.cycleA, f.roleA, f.chiefA.NUID).Scan(&board).Error)
	f.exec("INSERT INTO draft_teams (draft_id, preference_list_id, position) VALUES (?, ?, 0)", board, list)
	check("Chief starts the draft", nil,
		map[workflow.TaskKind]workflow.Status{workflow.TaskDraft: open, workflow.TaskFeedback: ""})

	f.exec("UPDATE drafts SET status = 'complete' WHERE id = ?", board)
	_, _, err = f.s.workflow.Decide(f.confirmed(f.chiefA), f.cycleA, f.roleA, []string{app})
	f.must(err)
	check("Draft finished and finalized", map[workflow.Page]bool{workflow.PageFeedback: false},
		map[workflow.TaskKind]workflow.Status{workflow.TaskDraft: done, workflow.TaskFeedback: locked})

	for _, r := range []string{f.roleA, f.roleA2} {
		f.release(r, models.StepFeedback)
	}
	check("Chief opens Feedback", map[workflow.Page]bool{workflow.PageFeedback: true},
		map[workflow.TaskKind]workflow.Status{workflow.TaskFeedback: open})
	f.wantStage(app, models.StageAccepted)
	f.wantStage(other, models.StageRejected)
}

package interviewboard

import (
	"fmt"
	"slices"
	"strings"

	"github.com/GenerateNU/apportal/backend/internal/interviewplan"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/staffing"
)

var (
	interviewStages = []models.ApplicationStage{models.StageInterview, models.StageInterviewScheduled,
		models.StageInterviewConducted, models.StageInterviewReview}
	unscheduled = []models.ApplicationStage{models.StageInterview, models.StageInterviewScheduled}
)

type facts struct {
	roles     []string
	staffSlot map[string]string
	appSlots  map[string][]string
	panels    []models.InterviewPanelDetail
	names     map[string]string
}

type options struct {
	byPanel, matchSlots, withRecording bool
}

func (f facts) name(nuid string) string {
	if n := f.names[nuid]; n != "" {
		return n
	}
	return nuid
}

// Picks go into snap as made, so recording reviewers see planned interviewers and every pick passes staffing.Check.
func buildPlan(snap staffing.Snapshot, f facts, opt options) InterviewPlan {
	out := InterviewPlan{MatchSlots: opt.matchSlots, Interviewers: []PlannedAssignment{}, RecordingReviewers: []PlannedAssignment{},
		ShortInterviewers: []string{}, ShortRecording: []string{}, NoSlotMatch: []string{}, Loads: []PlanLoad{}, Warnings: []string{}}
	roles := []string{}
	for _, r := range f.roles {
		if err := snap.AddBlocked(r, models.KindInterviewer); err != nil {
			out.Warnings = append(out.Warnings, fmt.Sprintf("Opening %s was skipped: %s.", r, err))
			continue
		}
		roles = append(roles, r)
	}
	existing := loads(snap)

	var res interviewplan.Result
	res, out.Interviewers = planKind(snap, f, roles, models.KindInterviewer, opt, &out.Warnings)
	out.ShortInterviewers, out.NoSlotMatch = res.Short, res.NoSlotMatch
	if opt.withRecording {
		if snap.Limits[models.KindRecordingReviewer] <= 0 {
			out.Warnings = append(out.Warnings, "Recording reviews are off for this cycle.")
		} else {
			res, out.RecordingReviewers = planKind(snap, f, roles, models.KindRecordingReviewer, options{}, &out.Warnings)
			out.ShortRecording = res.Short
		}
	}

	added := map[models.StepKind]map[string]int{models.KindInterviewer: {}, models.KindRecordingReviewer: {}}
	for _, p := range append(slices.Clone(out.Interviewers), out.RecordingReviewers...) {
		added[p.Kind][p.NUID]++
	}
	for _, kind := range []models.StepKind{models.KindInterviewer, models.KindRecordingReviewer} {
		people := map[string]bool{}
		for n := range existing[kind] {
			people[n] = true
		}
		for n := range added[kind] {
			people[n] = true
		}
		for _, n := range sortedKeys(people) {
			out.Loads = append(out.Loads, PlanLoad{NUID: n, FullName: f.name(n), Kind: kind, Existing: existing[kind][n], Added: added[kind][n]})
		}
	}
	return out
}

func planKind(snap staffing.Snapshot, f facts, roles []string, kind models.StepKind, opt options, warnings *[]string) (interviewplan.Result, []PlannedAssignment) {
	limit := snap.Limits[kind]
	stages := interviewStages
	if kind == models.KindInterviewer {
		stages = unscheduled
	}
	byPanel := opt.byPanel && kind == models.KindInterviewer
	openings := make([]interviewplan.Opening, 0, len(roles))
	for _, r := range roles {
		eligible := snap.Openings.Eligible(r, kind)
		o := interviewplan.Opening{RoleID: r}
		if byPanel {
			o.Units = panelUnits(f, eligible, limit)
			if len(o.Units) == 0 {
				*warnings = append(*warnings, fmt.Sprintf("No panel for opening %s is made only of its interviewers and within the interviewer count.", r))
			}
		} else {
			for _, n := range eligible {
				o.Units = append(o.Units, interviewplan.Unit{ID: n, Members: []string{n}, Slot: f.staffSlot[n]})
			}
		}
		for _, id := range sortedKeys(snap.Applicants) {
			a := snap.Applicants[id]
			if a.RoleID != r || !slices.Contains(stages, a.Stage) {
				continue
			}
			have := len(a.Assigned[kind])
			need := max(0, limit-have)
			if byPanel {
				need = 0
				if have == 0 && limit > 0 {
					need = 1
				}
			}
			blocked := map[string]bool{}
			for n := range a.Conflicted {
				blocked[n] = a.Conflicted[n]
			}
			for _, k := range []models.StepKind{models.KindInterviewer, models.KindRecordingReviewer} {
				for _, n := range a.Assigned[k] {
					blocked[n] = true
				}
			}
			o.Applicants = append(o.Applicants, interviewplan.Applicant{ID: id, Need: need, Blocked: blocked, Slots: f.appSlots[id]})
		}
		openings = append(openings, o)
	}
	res := interviewplan.Plan(openings, loads(snap)[kind], opt.matchSlots && kind == models.KindInterviewer)

	planned := []PlannedAssignment{}
	for _, p := range res.Picks {
		panelID := ""
		if byPanel {
			panelID = p.Unit.ID
		}
		for _, n := range p.Unit.Members {
			if snap.Check(p.ApplicationID, n, kind) != nil {
				continue
			}
			a := snap.Applicants[p.ApplicationID]
			a.Assigned[kind] = append(a.Assigned[kind], n)
			planned = append(planned, PlannedAssignment{ApplicationID: p.ApplicationID, Kind: kind, NUID: n, FullName: f.name(n), PanelID: panelID})
		}
	}
	return res, planned
}

func panelUnits(f facts, eligible []string, limit int) []interviewplan.Unit {
	var out []interviewplan.Unit
	for _, p := range f.panels {
		if len(p.Members) == 0 || len(p.Members) > limit {
			continue
		}
		members := make([]string, len(p.Members))
		slot := f.staffSlot[p.Members[0].UserNUID]
		ok := true
		for i, m := range p.Members {
			members[i] = m.UserNUID
			ok = ok && slices.Contains(eligible, m.UserNUID)
			if f.staffSlot[m.UserNUID] != slot {
				slot = ""
			}
		}
		if ok {
			out = append(out, interviewplan.Unit{ID: p.ID, Members: members, Slot: slot})
		}
	}
	return out
}

func loads(snap staffing.Snapshot) map[models.StepKind]map[string]int {
	out := map[models.StepKind]map[string]int{models.KindInterviewer: {}, models.KindRecordingReviewer: {}}
	for _, a := range snap.Applicants {
		for kind, m := range out {
			for _, n := range a.Assigned[kind] {
				m[n]++
			}
		}
	}
	return out
}

func sortedKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	slices.SortFunc(out, strings.Compare)
	return out
}

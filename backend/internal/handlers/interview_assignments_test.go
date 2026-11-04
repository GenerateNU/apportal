package handlers

import (
	"context"
	"net/http"
	"testing"
)

func TestAddInterviewerRequiresIdentity(t *testing.T) {
	h := &interviewAssignmentHandler{}
	in := &AddInterviewerInput{ID: "app1"}
	in.Body.InterviewerNUID = "l2"

	_, err := h.addInterviewer(context.Background(), in)
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestAddInterviewerIsChiefOnly(t *testing.T) {
	h := &interviewAssignmentHandler{}
	in := &AddInterviewerInput{ID: "app1"}
	in.Body.InterviewerNUID = "l1"

	_, err := h.addInterviewer(withActor(leadActor()), in)
	wantStatus(t, err, http.StatusForbidden)
}

func TestAddInterviewerRequiresNUID(t *testing.T) {
	h := &interviewAssignmentHandler{}
	for _, nuid := range []string{"", "   "} {
		in := &AddInterviewerInput{ID: "app1"}
		in.Body.InterviewerNUID = nuid

		_, err := h.addInterviewer(withActor(chiefActor()), in)
		wantStatus(t, err, http.StatusUnprocessableEntity)
	}
}

func TestListInterviewersRequiresReviewer(t *testing.T) {
	h := &interviewAssignmentHandler{}
	_, err := h.listInterviewers(context.Background(), &ApplicationScopedInput{ID: "app1"})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestUnassignInterviewerIsChiefOnly(t *testing.T) {
	h := &interviewAssignmentHandler{}

	_, err := h.unassignInterviewer(context.Background(), &IDInput{ID: "ia1"})
	wantStatus(t, err, http.StatusUnauthorized)

	_, err = h.unassignInterviewer(withActor(leadActor()), &IDInput{ID: "ia1"})
	wantStatus(t, err, http.StatusForbidden)
}

package interview

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// Only the checks that return before the handler touches the database are
// reachable without a database — same convention as answers_test.go.

func TestInterviewsBulkRequiresReviewer(t *testing.T) {
	s := &interviewService{}

	_, err := s.listBulk(context.Background(), &ListInterviewsBulkInput{
		ApplicationIDs: "app-1,app-2",
	})
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnauthorized {
		t.Fatalf("got %v, want 401", err)
	}
}

func TestInterviewsBulkParsesIDs(t *testing.T) {
	s := &interviewService{}
	lead := middleware.Actor{NUID: "l1"}

	// Blank entries are dropped, and an empty list short-circuits to no rows
	// rather than querying for none.
	out, err := s.listBulk(testutil.WithActor(lead), &ListInterviewsBulkInput{ApplicationIDs: " , ,"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Body) != 0 {
		t.Fatalf("got %d interviews, want 0", len(out.Body))
	}

	ids := make([]string, utils.MaxBulkApplications+1)
	for i := range ids {
		ids[i] = "app"
	}
	_, err = s.listBulk(testutil.WithActor(lead), &ListInterviewsBulkInput{
		ApplicationIDs: strings.Join(ids, ","),
	})
	var se huma.StatusError
	if !errors.As(err, &se) || se.GetStatus() != http.StatusUnprocessableEntity {
		t.Fatalf("got %v, want 422", err)
	}
}

func TestMissingForSubmit(t *testing.T) {
	link, text := "https://x.com", "notes"
	rating := models.InterviewRating("great")
	full := models.Interview{RecordingURL: &link, NotesURL: &link, Writeup: &text, Rating: &rating}
	if msg := missingForSubmit(&UpsertInterviewInput{}, full); msg != "" {
		t.Fatalf("saved fields should satisfy submit, got %q", msg)
	}
	blank := ""
	in := &UpsertInterviewInput{}
	in.Body.NotesURL = &blank
	if msg := missingForSubmit(in, full); msg != "a notes link is required to submit" {
		t.Fatalf("cleared notes link should block submit, got %q", msg)
	}
	if msg := missingForSubmit(&UpsertInterviewInput{}, models.Interview{}); msg != "a recording link is required to submit" {
		t.Fatalf("empty interview should block submit, got %q", msg)
	}
}

func TestNeedsSubmitCheck(t *testing.T) {
	text := "x"
	when := time.Now()
	submit := &UpsertInterviewInput{}
	submit.Body.Submit = true
	writeup := &UpsertInterviewInput{}
	writeup.Body.Writeup = &text
	schedule := &UpsertInterviewInput{}
	schedule.Body.ScheduledAt = &when
	cases := []struct {
		name      string
		in        *UpsertInterviewInput
		submitted bool
		want      bool
	}{
		{"submitting always checks", submit, false, true},
		{"draft edit skips", writeup, false, false},
		{"editing a submitted write-up checks", writeup, true, true},
		{"rescheduling a submitted interview skips", schedule, true, false},
	}
	for _, c := range cases {
		if got := needsSubmitCheck(c.in, c.submitted); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

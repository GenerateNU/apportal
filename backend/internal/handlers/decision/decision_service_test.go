package decision

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// These cover the paths that return before the handler touches the database; the
// rest need a real database and are exercised by integration/manual testing.

func chiefActor() middleware.Actor {
	return middleware.Actor{NUID: "c1", Roles: []models.UserRole{models.UserRoleChief}}
}

func leadActor() middleware.Actor {
	return middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}
}

func TestListDecisionsRequiresReviewer(t *testing.T) {
	s := &decisionService{}
	_, err := s.list(context.Background(), &ListDecisionsInput{ID: "cycle1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestListDecisionsValidatesFilters(t *testing.T) {
	s := &decisionService{}
	ctx := testutil.WithActor(leadActor())

	_, err := s.list(ctx, &ListDecisionsInput{ID: "cycle1", Role: "not-a-role"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)

	_, err = s.list(ctx, &ListDecisionsInput{ID: "cycle1", Kind: "rejection_maybe"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestListDecisionTemplatesRequiresRole(t *testing.T) {
	s := &decisionService{}
	_, err := s.listTemplates(testutil.WithActor(leadActor()), &ListDecisionTemplatesInput{ID: "cycle1"})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestUpdateDecisionTemplateIsChiefOnly(t *testing.T) {
	s := &decisionService{}
	in := &UpdateDecisionTemplateInput{ID: "cycle1", Role: "software_engineer", Kind: "rejection_generic"}
	in.Body.Subject = "s"
	in.Body.Body = "b"

	_, err := s.updateTemplate(testutil.WithActor(leadActor()), in)
	testutil.WantStatus(t, err, http.StatusForbidden)
}

func TestUpdateDecisionTemplateValidatesKind(t *testing.T) {
	s := &decisionService{}
	in := &UpdateDecisionTemplateInput{ID: "cycle1", Role: "software_engineer", Kind: ""}
	in.Body.Subject = "s"
	in.Body.Body = "b"

	_, err := s.updateTemplate(testutil.WithActor(chiefActor()), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestUpsertDecisionRequiresReviewer(t *testing.T) {
	s := &decisionService{}
	_, err := s.upsert(context.Background(), &UpsertDecisionInput{ID: "app1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestUpsertDecisionRejectsChiefOnlyFieldsFromLead(t *testing.T) {
	override := "rewritten by hand"
	sent := true
	kind := models.DecisionRejectionGeneric

	cases := []struct {
		name  string
		apply func(in *UpsertDecisionInput)
	}{
		{"body_override", func(in *UpsertDecisionInput) { in.Body.BodyOverride = &override }},
		{"mark_sent", func(in *UpsertDecisionInput) { in.Body.MarkSent = &sent }},
		{"kind", func(in *UpsertDecisionInput) { in.Body.Kind = &kind }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := &decisionService{}
			in := &UpsertDecisionInput{ID: "app1"}
			tc.apply(in)
			_, err := s.upsert(testutil.WithActor(leadActor()), in)
			testutil.WantStatus(t, err, http.StatusForbidden)
		})
	}
}

func TestUpsertDecisionValidatesKind(t *testing.T) {
	s := &decisionService{}
	bad := models.DecisionKind("rejection_maybe")
	in := &UpsertDecisionInput{ID: "app1"}
	in.Body.Kind = &bad

	_, err := s.upsert(testutil.WithActor(chiefActor()), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestListDecisionContextRequiresReviewer(t *testing.T) {
	s := &decisionService{}
	_, err := s.context(context.Background(), &ListDecisionContextInput{ApplicationIDs: "app1"})
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestListDecisionContextBoundsTheBatch(t *testing.T) {
	s := &decisionService{}
	ids := make([]string, utils.MaxBulkApplications+1)
	for i := range ids {
		ids[i] = "app"
	}

	_, err := s.context(testutil.WithActor(chiefActor()), &ListDecisionContextInput{
		ApplicationIDs: strings.Join(ids, ","),
	})
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

// An empty list short-circuits before the database, so this also pins that an
// unset param isn't read as one blank id.
func TestListDecisionContextIgnoresBlankIDs(t *testing.T) {
	s := &decisionService{}
	out, err := s.context(testutil.WithActor(chiefActor()), &ListDecisionContextInput{
		ApplicationIDs: " , ,",
	})
	if err != nil {
		t.Fatalf("got %v, want no error", err)
	}
	if len(out.Body) != 0 {
		t.Fatalf("got %d entries, want 0", len(out.Body))
	}
}

func TestOwnWrittenReviewsWithholdsPeers(t *testing.T) {
	reviews := []models.WrittenReviewDetail{
		{WrittenReview: models.WrittenReview{ReviewerNUID: "l1"}},
		{WrittenReview: models.WrittenReview{ReviewerNUID: "l2"}},
	}

	kept, blind := ownWrittenReviews(reviews, "l1")
	if len(kept) != 1 || kept[0].ReviewerNUID != "l1" {
		t.Fatalf("got %v, want only l1's review", kept)
	}
	if !blind {
		t.Error("got blind=false, want true — a peer's review was withheld")
	}

	// Nothing withheld when the caller wrote the only review.
	kept, blind = ownWrittenReviews(reviews[:1], "l1")
	if len(kept) != 1 || blind {
		t.Errorf("got %d kept, blind=%v; want 1, false", len(kept), blind)
	}
}

func TestRedactPeerCommentsKeepsRatings(t *testing.T) {
	comment := "solid answers"
	rating := models.RatingGood
	reviews := []models.RecordingReviewDetail{
		{InterviewRecordingReview: models.InterviewRecordingReview{ReviewerNUID: "l1", Comments: &comment, Rating: &rating}},
		{InterviewRecordingReview: models.InterviewRecordingReview{ReviewerNUID: "l2", Comments: &comment, Rating: &rating}},
	}

	got, redacted := redactPeerComments(reviews, "l1")
	if !redacted {
		t.Error("got redacted=false, want true")
	}
	if got[0].Comments == nil {
		t.Error("the caller's own comment was redacted")
	}
	if got[1].Comments != nil {
		t.Error("a peer's comment survived redaction")
	}
	if got[1].Rating == nil {
		t.Error("a peer's rating was redacted; only comments are blind")
	}
}

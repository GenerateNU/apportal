package handlers

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
)

// These cover the paths that return before the handler touches its store; the
// rest need a real database and are exercised by integration/manual testing.

func chiefActor() middleware.Actor {
	return middleware.Actor{NUID: "c1", Roles: []models.UserRole{models.UserRoleChief}}
}

func leadActor() middleware.Actor {
	return middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}}
}

func TestListDecisionsRequiresReviewer(t *testing.T) {
	h := &decisionHandler{}
	_, err := h.list(context.Background(), &ListDecisionsInput{ID: "cycle1"})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestListDecisionsValidatesFilters(t *testing.T) {
	h := &decisionHandler{}
	ctx := withActor(leadActor())

	_, err := h.list(ctx, &ListDecisionsInput{ID: "cycle1", Role: "not-a-role"})
	wantStatus(t, err, http.StatusUnprocessableEntity)

	_, err = h.list(ctx, &ListDecisionsInput{ID: "cycle1", Kind: "rejection_maybe"})
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestListDecisionTemplatesRequiresRole(t *testing.T) {
	h := &decisionHandler{}
	_, err := h.listTemplates(withActor(leadActor()), &ListDecisionTemplatesInput{ID: "cycle1"})
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestUpdateDecisionTemplateIsChiefOnly(t *testing.T) {
	h := &decisionHandler{}
	in := &UpdateDecisionTemplateInput{ID: "cycle1", Role: "software_engineer", Kind: "rejection_generic"}
	in.Body.Subject = "s"
	in.Body.Body = "b"

	_, err := h.updateTemplate(withActor(leadActor()), in)
	wantStatus(t, err, http.StatusForbidden)
}

func TestUpdateDecisionTemplateValidatesKind(t *testing.T) {
	h := &decisionHandler{}
	in := &UpdateDecisionTemplateInput{ID: "cycle1", Role: "software_engineer", Kind: ""}
	in.Body.Subject = "s"
	in.Body.Body = "b"

	_, err := h.updateTemplate(withActor(chiefActor()), in)
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestUpsertDecisionRequiresReviewer(t *testing.T) {
	h := &decisionHandler{}
	_, err := h.upsert(context.Background(), &UpsertDecisionInput{ID: "app1"})
	wantStatus(t, err, http.StatusUnauthorized)
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
			h := &decisionHandler{}
			in := &UpsertDecisionInput{ID: "app1"}
			tc.apply(in)
			_, err := h.upsert(withActor(leadActor()), in)
			wantStatus(t, err, http.StatusForbidden)
		})
	}
}

func TestUpsertDecisionValidatesKind(t *testing.T) {
	h := &decisionHandler{}
	bad := models.DecisionKind("rejection_maybe")
	in := &UpsertDecisionInput{ID: "app1"}
	in.Body.Kind = &bad

	_, err := h.upsert(withActor(chiefActor()), in)
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestListDecisionContextRequiresReviewer(t *testing.T) {
	h := &decisionHandler{}
	_, err := h.context(context.Background(), &ListDecisionContextInput{ApplicationIDs: "app1"})
	wantStatus(t, err, http.StatusUnauthorized)
}

func TestListDecisionContextBoundsTheBatch(t *testing.T) {
	h := &decisionHandler{}
	ids := make([]string, maxBulkApplications+1)
	for i := range ids {
		ids[i] = "app"
	}

	_, err := h.context(withActor(chiefActor()), &ListDecisionContextInput{
		ApplicationIDs: strings.Join(ids, ","),
	})
	wantStatus(t, err, http.StatusUnprocessableEntity)
}

// An empty list short-circuits before the store, so this also pins that an
// unset param isn't read as one blank id.
func TestListDecisionContextIgnoresBlankIDs(t *testing.T) {
	h := &decisionHandler{}
	out, err := h.context(withActor(chiefActor()), &ListDecisionContextInput{
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

package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/store"
)

// decisionHandler runs the decisions page: the per-cycle rejection letters and
// the per-applicant paragraphs that fill them in. Reads are open to any
// reviewer so a lead can find their own queue; template edits are chief-only,
// and a lead may only write the feedback for applicants they interviewed.
type decisionHandler struct {
	store *store.Store
}

func (h *decisionHandler) register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-decision-templates",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/decision-templates",
		Summary:     "A cycle's rejection letter templates for one role",
		Description: "Reviewer only. ?role= selects the role (required). Returns both kinds, creating default-content rows on first access.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.listTemplates)

	huma.Register(api, huma.Operation{
		OperationID: "update-decision-template",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/decision-templates",
		Summary:     "Replace one rejection letter template",
		Description: "Chief only. ?role= and ?kind= select which letter (both required). Replaces subject and body together — there is no partial update.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.updateTemplate)

	huma.Register(api, huma.Operation{
		OperationID: "list-decisions",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/decisions",
		Summary:     "Every applicant in a cycle who is getting a rejection",
		Description: "Reviewer only. Excludes accepted, withdrawn, and unsubmitted applications. Each row carries the applicant, which letter applies, who owes the feedback, and whatever has been written — the page needs no per-applicant follow-up.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "list-decision-context",
		Method:      http.MethodGet,
		Path:        "/decisions/context",
		Summary:     "The review history behind a batch of decisions",
		Description: "Reviewer only. ?application_ids= is comma-separated. Returns each applicant's interview write-up, recording reviews, and lead written reviews — the material an interviewer draws on to write feedback. Blind review still applies: a lead sees only their own written review, and peers' recording comments are withheld, until a chief releases the cycle's reviews. Leads only get applicants they interviewed.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusUnprocessableEntity},
	}, h.context)

	huma.Register(api, huma.Operation{
		OperationID: "upsert-decision",
		Method:      http.MethodPut,
		Path:        "/applications/{id}/decision",
		Summary:     "Write an applicant's decision feedback",
		Description: "The assigned interviewer may write feedback and compliments for their own applicants. Chiefs may additionally change the kind, override the whole message, and mark it sent.",
		Tags:        []string{"Decisions"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, h.upsert)
}

type DecisionTemplatesOutput struct {
	Body []models.DecisionTemplate
}

type DecisionTemplateOutput struct {
	Body models.DecisionTemplate
}

type DecisionsOutput struct {
	Body []models.DecisionRow
}

type DecisionOutput struct {
	Body models.DecisionRow
}

func parseDecisionKind(raw string) (models.DecisionKind, error) {
	kind := models.DecisionKind(raw)
	if raw == "" || !kind.Valid() {
		return "", huma.Error422UnprocessableEntity("missing or invalid kind")
	}
	return kind, nil
}

type ListDecisionTemplatesInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
}

func (h *decisionHandler) listTemplates(ctx context.Context, in *ListDecisionTemplatesInput) (*DecisionTemplatesOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := parseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	templates, err := h.store.GetOrCreateDecisionTemplates(ctx, in.ID, role)
	if err != nil {
		return nil, storeErr(err)
	}
	return &DecisionTemplatesOutput{Body: templates}, nil
}

type UpdateDecisionTemplateInput struct {
	ID   string `path:"id" doc:"Cycle ID"`
	Role string `query:"role" doc:"Applicant role"`
	Kind string `query:"kind" doc:"Which letter" enum:"rejection_post_interview,rejection_generic"`
	Body struct {
		Subject string `json:"subject" minLength:"1"`
		Body    string `json:"body" minLength:"1"`
	}
}

func (h *decisionHandler) updateTemplate(ctx context.Context, in *UpdateDecisionTemplateInput) (*DecisionTemplateOutput, error) {
	if err := requireChief(ctx); err != nil {
		return nil, err
	}
	role, err := parseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	kind, err := parseDecisionKind(in.Kind)
	if err != nil {
		return nil, err
	}
	// Seed first so editing a letter nobody has opened yet updates rather than
	// 404s.
	if _, err := h.store.GetOrCreateDecisionTemplates(ctx, in.ID, role); err != nil {
		return nil, storeErr(err)
	}
	t, err := h.store.UpdateDecisionTemplate(ctx, in.ID, role, kind, store.DecisionTemplateUpdate{
		Subject:   in.Body.Subject,
		Body:      in.Body.Body,
		UpdatedBy: currentActor(ctx).NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &DecisionTemplateOutput{Body: t}, nil
}

type ListDecisionsInput struct {
	ID              string `path:"id" doc:"Cycle ID"`
	Role            string `query:"role" doc:"Applicant role; omit for both"`
	Kind            string `query:"kind" doc:"Which letter applies" enum:"rejection_post_interview,rejection_generic"`
	InterviewerNUID string `query:"interviewer_nuid" doc:"Limit to applicants this reviewer interviewed — a lead's own feedback queue"`
	Search          string `query:"search" doc:"Case-insensitive substring match on the applicant's name, NUID, or email"`
}

func (h *decisionHandler) list(ctx context.Context, in *ListDecisionsInput) (*DecisionsOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	filter := store.DecisionFilter{
		CycleID:         in.ID,
		InterviewerNUID: in.InterviewerNUID,
		Search:          in.Search,
	}
	// A lead's decisions queue is only the applicants they interviewed —
	// enforced here rather than left to the client's filter, since writing the
	// feedback is the only reason they have access to this page at all.
	if !currentActor(ctx).HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		filter.InterviewerNUID = currentActor(ctx).NUID
	}
	if in.Role != "" {
		role, err := parseTemplateRole(in.Role)
		if err != nil {
			return nil, err
		}
		filter.Role = &role
	}
	if in.Kind != "" {
		kind, err := parseDecisionKind(in.Kind)
		if err != nil {
			return nil, err
		}
		filter.Kind = &kind
	}
	rows, err := h.store.ListDecisions(ctx, filter)
	if err != nil {
		return nil, storeErr(err)
	}
	if rows == nil {
		rows = []models.DecisionRow{}
	}
	return &DecisionsOutput{Body: rows}, nil
}

type UpsertDecisionInput struct {
	ID   string `path:"id" doc:"Application ID"`
	Body struct {
		Feedback    *string `json:"feedback,omitempty" doc:"The \"to shed some light\" paragraph. Empty string clears it."`
		Compliments *string `json:"compliments,omitempty" doc:"The \"I really loved talking to you about\" paragraph. Empty string clears it."`
		// The three below are chief-only; a lead sending any of them is
		// rejected rather than silently ignored.
		Kind         *models.DecisionKind `json:"kind,omitempty" doc:"Chief only. Overrides which letter applies."`
		BodyOverride *string              `json:"body_override,omitempty" doc:"Chief only. Replaces the rendered message wholesale. Empty string reverts to the template."`
		MarkSent     *bool                `json:"mark_sent,omitempty" doc:"Chief only. Records that the message was emailed, and moves the applicant to the rejected stage with it. Setting it false restores the stage they were in before."`
	}
}

func (h *decisionHandler) upsert(ctx context.Context, in *UpsertDecisionInput) (*DecisionOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	actor := currentActor(ctx)
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)

	if in.Body.Kind != nil && !in.Body.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid kind")
	}

	// Checked before the read below, since it turns on the fields sent rather
	// than on anything about the row.
	if !isChief && (in.Body.Kind != nil || in.Body.BodyOverride != nil || in.Body.MarkSent != nil) {
		return nil, huma.Error403Forbidden("chief role required to change the kind, override the message, or mark it sent")
	}

	// The existing row decides both who may write and which letter applies.
	row, err := h.store.GetDecisionRow(ctx, in.ID)
	if err != nil {
		return nil, storeErr(err)
	}
	if !isChief && (row.InterviewerNUID == nil || *row.InterviewerNUID != actor.NUID) {
		return nil, huma.Error403Forbidden("only this applicant's interviewer or a chief can write their decision")
	}

	kind := row.Kind
	if in.Body.Kind != nil {
		kind = *in.Body.Kind
	}
	updated, err := h.store.UpsertDecisionDraft(ctx, in.ID, store.DecisionDraftUpdate{
		Kind:         kind,
		Feedback:     in.Body.Feedback,
		Compliments:  in.Body.Compliments,
		BodyOverride: in.Body.BodyOverride,
		AuthorNUID:   actor.NUID,
		MarkSent:     in.Body.MarkSent,
		SentBy:       actor.NUID,
	})
	if err != nil {
		return nil, storeErr(err)
	}
	return &DecisionOutput{Body: updated}, nil
}

type DecisionContextOutput struct {
	Body []models.DecisionContext
}

type ListDecisionContextInput struct {
	// Comma-separated rather than a repeated/array param because huma splits
	// this form itself, while the browser client serializes arrays as
	// `application_ids[]=…`, which binds to nothing server-side.
	ApplicationIDs string `query:"application_ids" doc:"Comma-separated application IDs"`
}

func (h *decisionHandler) context(ctx context.Context, in *ListDecisionContextInput) (*DecisionContextOutput, error) {
	if err := requireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := splitIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &DecisionContextOutput{Body: []models.DecisionContext{}}, nil
	}
	if len(ids) > maxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}

	actor := currentActor(ctx)
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)

	// Running the ids back through the decisions list is what enforces access:
	// it drops anything outside the caller's queue, so a lead can't read the
	// reviews of an applicant they didn't interview by naming their id here.
	filter := store.DecisionFilter{ApplicationIDs: ids}
	if !isChief {
		filter.InterviewerNUID = actor.NUID
	}
	rows, err := h.store.ListDecisions(ctx, filter)
	if err != nil {
		return nil, storeErr(err)
	}
	if len(rows) == 0 {
		return &DecisionContextOutput{Body: []models.DecisionContext{}}, nil
	}
	allowed := make([]string, len(rows))
	for i, r := range rows {
		allowed[i] = r.ApplicationID
	}

	interviews, err := h.store.ListInterviewsForApplications(ctx, allowed)
	if err != nil {
		return nil, storeErr(err)
	}
	interviewByApplication := make(map[string]models.Interview, len(interviews))
	interviewIDs := make([]string, 0, len(interviews))
	for _, iv := range interviews {
		interviewByApplication[iv.ApplicationID] = iv
		interviewIDs = append(interviewIDs, iv.ID)
	}

	recordingReviews, err := h.store.ListRecordingReviewDetailsForInterviews(ctx, interviewIDs)
	if err != nil {
		return nil, storeErr(err)
	}
	// Fetched unscoped and narrowed below, because release is per cycle × role
	// and one batch can span both roles — a single SQL-level onlyReviewer (what
	// the one-application route uses) can't express that.
	writtenReviews, err := h.store.ListWrittenReviewsForApplications(ctx, allowed, "")
	if err != nil {
		return nil, storeErr(err)
	}

	writtenReleased := map[string]bool{}
	recordingReleased := map[string]bool{}
	if !isChief {
		if writtenReleased, err = h.store.ReleasedApplications(ctx, models.ReviewKindWritten, allowed); err != nil {
			return nil, storeErr(err)
		}
		if recordingReleased, err = h.store.ReleasedApplications(ctx, models.ReviewKindRecording, allowed); err != nil {
			return nil, storeErr(err)
		}
	}

	out := make([]models.DecisionContext, 0, len(allowed))
	for _, applicationID := range allowed {
		entry := models.DecisionContext{
			ApplicationID:  applicationID,
			WrittenReviews: writtenReviews[applicationID],
		}
		if iv, ok := interviewByApplication[applicationID]; ok {
			entry.Interview = &iv
			entry.RecordingReviews = recordingReviews[iv.ID]
		}

		if !isChief && !writtenReleased[applicationID] {
			entry.WrittenReviews, entry.WrittenReviewsBlind = ownWrittenReviews(entry.WrittenReviews, actor.NUID)
		}
		if !isChief && !recordingReleased[applicationID] {
			entry.RecordingReviews, entry.RecordingReviewsBlind = redactPeerComments(entry.RecordingReviews, actor.NUID)
		}

		if entry.WrittenReviews == nil {
			entry.WrittenReviews = []models.WrittenReviewDetail{}
		}
		if entry.RecordingReviews == nil {
			entry.RecordingReviews = []models.RecordingReviewDetail{}
		}
		out = append(out, entry)
	}
	return &DecisionContextOutput{Body: out}, nil
}

// ownWrittenReviews keeps only the caller's own review, and reports whether
// anything was withheld so the UI can say so rather than showing an empty
// panel that reads as "nobody reviewed them".
func ownWrittenReviews(reviews []models.WrittenReviewDetail, nuid string) ([]models.WrittenReviewDetail, bool) {
	kept := make([]models.WrittenReviewDetail, 0, len(reviews))
	for _, r := range reviews {
		if r.ReviewerNUID == nuid {
			kept = append(kept, r)
		}
	}
	return kept, len(kept) < len(reviews)
}

// redactPeerComments blanks other reviewers' written comments while leaving
// their ratings visible — the same split the one-interview route makes.
func redactPeerComments(reviews []models.RecordingReviewDetail, nuid string) ([]models.RecordingReviewDetail, bool) {
	redacted := false
	for i := range reviews {
		if reviews[i].ReviewerNUID != nuid && reviews[i].Comments != nil {
			reviews[i].Comments = nil
			redacted = true
		}
	}
	return reviews, redacted
}

// splitIDs parses a comma-separated id list, dropping blanks.
func splitIDs(raw string) []string {
	ids := make([]string, 0, 8)
	for _, id := range strings.Split(raw, ",") {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

package decision

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/recordingreview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/handlers/writtenreview"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"
)

// decisionService runs the decisions page: the per-cycle rejection letters and
// the per-applicant paragraphs that fill them in. Reads are open to any
// reviewer so a lead can find their own queue; template edits are chief-only,
// and a lead may only write the feedback for applicants they interviewed.
type decisionService struct {
	decisionDB        *DecisionDB
	interviewDB       *interview.InterviewDB
	recordingReviewDB *recordingreview.RecordingReviewDB
	reviewReleaseDB   *reviewrelease.ReviewReleaseDB
	writtenReviewDB   *writtenreview.WrittenReviewDB
}

func parseDecisionKind(raw string) (models.DecisionKind, error) {
	kind := models.DecisionKind(raw)
	if raw == "" || !kind.Valid() {
		return "", huma.Error422UnprocessableEntity("missing or invalid kind")
	}
	return kind, nil
}

func (s *decisionService) listTemplates(ctx context.Context, in *ListDecisionTemplatesInput) (*DecisionTemplatesOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	role, err := utils.ParseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	templates, err := s.decisionDB.GetOrCreateDecisionTemplates(ctx, in.ID, role)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DecisionTemplatesOutput{Body: templates}, nil
}

func (s *decisionService) updateTemplate(ctx context.Context, in *UpdateDecisionTemplateInput) (*DecisionTemplateOutput, error) {
	if err := utils.RequireChief(ctx); err != nil {
		return nil, err
	}
	role, err := utils.ParseTemplateRole(in.Role)
	if err != nil {
		return nil, err
	}
	kind, err := parseDecisionKind(in.Kind)
	if err != nil {
		return nil, err
	}
	// Seed first so editing a letter nobody has opened yet updates rather than
	// 404s.
	if _, err := s.decisionDB.GetOrCreateDecisionTemplates(ctx, in.ID, role); err != nil {
		return nil, utils.StoreErr(err)
	}
	t, err := s.decisionDB.UpdateDecisionTemplate(ctx, in.ID, role, kind, DecisionTemplateUpdate{
		Subject:   in.Body.Subject,
		Body:      in.Body.Body,
		UpdatedBy: utils.CurrentActor(ctx).NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DecisionTemplateOutput{Body: t}, nil
}

func (s *decisionService) list(ctx context.Context, in *ListDecisionsInput) (*DecisionsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	filter := DecisionFilter{
		CycleID:         in.ID,
		InterviewerNUID: in.InterviewerNUID,
		Search:          in.Search,
	}
	// A lead's decisions queue is only the applicants they interviewed —
	// enforced here rather than left to the client's filter, since writing the
	// feedback is the only reason they have access to this page at all.
	if !utils.CurrentActor(ctx).HasAnyRole(models.UserRoleChief, models.UserRoleAdmin) {
		filter.InterviewerNUID = utils.CurrentActor(ctx).NUID
	}
	if in.Role != "" {
		role, err := utils.ParseTemplateRole(in.Role)
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
	rows, err := s.decisionDB.ListDecisions(ctx, filter)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if rows == nil {
		rows = []models.DecisionRow{}
	}
	return &DecisionsOutput{Body: rows}, nil
}

func (s *decisionService) upsert(ctx context.Context, in *UpsertDecisionInput) (*DecisionOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	actor := utils.CurrentActor(ctx)
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
	row, err := s.decisionDB.GetDecisionRow(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !isChief && (row.InterviewerNUID == nil || *row.InterviewerNUID != actor.NUID) {
		return nil, huma.Error403Forbidden("only this applicant's interviewer or a chief can write their decision")
	}

	kind := row.Kind
	if in.Body.Kind != nil {
		kind = *in.Body.Kind
	}
	updated, err := s.decisionDB.UpsertDecisionDraft(ctx, in.ID, DecisionDraftUpdate{
		Kind:         kind,
		Feedback:     in.Body.Feedback,
		Compliments:  in.Body.Compliments,
		BodyOverride: in.Body.BodyOverride,
		AuthorNUID:   actor.NUID,
		MarkSent:     in.Body.MarkSent,
		SentBy:       actor.NUID,
	})
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DecisionOutput{Body: updated}, nil
}

func (s *decisionService) context(ctx context.Context, in *ListDecisionContextInput) (*DecisionContextOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := utils.SplitIDs(in.ApplicationIDs)
	if len(ids) == 0 {
		return &DecisionContextOutput{Body: []models.DecisionContext{}}, nil
	}
	if len(ids) > utils.MaxBulkApplications {
		return nil, huma.Error422UnprocessableEntity("too many application_ids")
	}

	actor := utils.CurrentActor(ctx)
	isChief := actor.HasAnyRole(models.UserRoleChief, models.UserRoleAdmin)

	// Running the ids back through the decisions list is what enforces access:
	// it drops anything outside the caller's queue, so a lead can't read the
	// reviews of an applicant they didn't interview by naming their id here.
	filter := DecisionFilter{ApplicationIDs: ids}
	if !isChief {
		filter.InterviewerNUID = actor.NUID
	}
	rows, err := s.decisionDB.ListDecisions(ctx, filter)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(rows) == 0 {
		return &DecisionContextOutput{Body: []models.DecisionContext{}}, nil
	}
	allowed := make([]string, len(rows))
	for i, r := range rows {
		allowed[i] = r.ApplicationID
	}

	interviews, err := s.interviewDB.ListInterviewsForApplications(ctx, allowed)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	interviewByApplication := make(map[string]models.Interview, len(interviews))
	interviewIDs := make([]string, 0, len(interviews))
	for _, iv := range interviews {
		interviewByApplication[iv.ApplicationID] = iv
		interviewIDs = append(interviewIDs, iv.ID)
	}

	recordingReviews, err := s.recordingReviewDB.ListRecordingReviewDetailsForInterviews(ctx, interviewIDs)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	// Fetched unscoped and narrowed below, because release is per cycle × role
	// and one batch can span both roles — a single SQL-level onlyReviewer (what
	// the one-application route uses) can't express that.
	writtenReviews, err := s.writtenReviewDB.ListWrittenReviewsForApplications(ctx, allowed, "")
	if err != nil {
		return nil, utils.StoreErr(err)
	}

	writtenReleased := map[string]bool{}
	recordingReleased := map[string]bool{}
	if !isChief {
		if writtenReleased, err = s.reviewReleaseDB.ReleasedApplications(ctx, models.ReviewKindWritten, allowed); err != nil {
			return nil, utils.StoreErr(err)
		}
		if recordingReleased, err = s.reviewReleaseDB.ReleasedApplications(ctx, models.ReviewKindRecording, allowed); err != nil {
			return nil, utils.StoreErr(err)
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

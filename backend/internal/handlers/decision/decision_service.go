package decision

import (
	"context"
	"slices"

	"github.com/GenerateNU/apportal/backend/internal/handlers/interview"
	"github.com/GenerateNU/apportal/backend/internal/handlers/interviewassignment"
	"github.com/GenerateNU/apportal/backend/internal/handlers/reviewrelease"
	"github.com/GenerateNU/apportal/backend/internal/handlers/role"
	"github.com/GenerateNU/apportal/backend/internal/handlers/writtenreview"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/access"
)

// decisionService runs the decisions page: the per-cycle rejection letters and
// the per-applicant paragraphs that fill them in. Reads are open to any
// cycle's reviewers so a lead can find their own queue; template edits need
// Manage, and a lead may only write feedback for applicants they interviewed.
type decisionService struct {
	access                *access.Checker
	decisionDB            *DecisionDB
	interviewDB           *interview.InterviewDB
	interviewAssignmentDB *interviewassignment.InterviewAssignmentDB
	reviewReleaseDB       *reviewrelease.ReviewReleaseDB
	writtenReviewDB       *writtenreview.WrittenReviewDB
	roleDB                *role.RoleDB
}

func parseDecisionKind(raw string) (models.DecisionKind, error) {
	kind := models.DecisionKind(raw)
	if raw == "" || !kind.Valid() {
		return "", huma.Error422UnprocessableEntity("missing or invalid kind")
	}
	return kind, nil
}

func (s *decisionService) listTemplates(ctx context.Context, in *ListDecisionTemplatesInput) (*DecisionTemplatesOutput, error) {
	if err := role.ParseRoleID(in.RoleID); err != nil {
		return nil, err
	}
	if err := s.access.RequireCycle(ctx, in.ID, access.Review); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	templates, err := s.decisionDB.GetOrCreateDecisionTemplates(ctx, in.ID, in.RoleID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &DecisionTemplatesOutput{Body: templates}, nil
}

func (s *decisionService) updateTemplate(ctx context.Context, in *UpdateDecisionTemplateInput) (*DecisionTemplateOutput, error) {
	kind, err := parseDecisionKind(in.Kind)
	if err != nil {
		return nil, err
	}
	if err := s.access.RequireCycle(ctx, in.ID, access.Manage); err != nil {
		return nil, err
	}
	if err := role.RequireCycleRole(ctx, s.roleDB, in.ID, in.RoleID); err != nil {
		return nil, err
	}
	// Seed first so editing a letter nobody has opened yet updates rather than
	// 404s.
	if _, err := s.decisionDB.GetOrCreateDecisionTemplates(ctx, in.ID, in.RoleID); err != nil {
		return nil, utils.StoreErr(err)
	}
	t, err := s.decisionDB.UpdateDecisionTemplate(ctx, in.ID, in.RoleID, kind, DecisionTemplateUpdate{
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
	filter := DecisionFilter{
		CycleID:         in.ID,
		InterviewerNUID: in.InterviewerNUID,
		Search:          in.Search,
	}
	if in.RoleID != "" {
		if err := role.ParseRoleID(in.RoleID); err != nil {
			return nil, err
		}
		filter.RoleID = &in.RoleID
	}
	if in.Kind != "" {
		kind, err := parseDecisionKind(in.Kind)
		if err != nil {
			return nil, err
		}
		filter.Kind = &kind
	}
	level, err := s.access.CycleLevel(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	if err := access.RequireLevel(level, access.Review); err != nil {
		return nil, err
	}
	// A lead's decisions queue is only the applicants they interviewed —
	// enforced here rather than left to the client's filter.
	if level < access.Manage {
		filter.InterviewerNUID = utils.CurrentActor(ctx).NUID
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
	if in.Body.Kind != nil && !in.Body.Kind.Valid() {
		return nil, huma.Error422UnprocessableEntity("invalid kind")
	}
	level, err := s.access.ApplicationLevelAtLeast(ctx, in.ID, access.Review)
	if err != nil {
		return nil, err
	}
	actor := utils.CurrentActor(ctx)
	isChief := level >= access.Manage
	if err := requireChiefFields(isChief, in); err != nil {
		return nil, err
	}

	// The existing row decides both who may write and which letter applies.
	row, err := s.decisionDB.GetDecisionRow(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if !isChief && !slices.ContainsFunc(row.Interviewers, func(iv models.DecisionInterviewer) bool { return iv.NUID == actor.NUID }) {
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
	if err := access.RequireActor(ctx); err != nil {
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
	rows, managed, err := s.contextRows(ctx, ids, actor.NUID)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return &DecisionContextOutput{Body: []models.DecisionContext{}}, nil
	}
	allowed := make([]string, len(rows))
	for i, r := range rows {
		allowed[i] = r.ApplicationID
	}

	interviews, err := s.interviewDB.ListInterviewDetails(ctx, allowed)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	interviewByApplication := make(map[string]models.InterviewDetail, len(interviews))
	for _, iv := range interviews {
		interviewByApplication[iv.ApplicationID] = iv
	}

	reviewers, err := s.interviewAssignmentDB.ListReviewers(ctx, allowed)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	recordingReviews := map[string][]models.InterviewReviewerDetail{}
	for _, r := range reviewers {
		recordingReviews[r.ApplicationID] = append(recordingReviews[r.ApplicationID], r)
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
	if len(managed) < len(allowed) {
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
			entry.RecordingReviews = recordingReviews[applicationID]
		}

		isChief := managed[applicationID]
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
			entry.RecordingReviews = []models.InterviewReviewerDetail{}
		}
		out = append(out, entry)
	}
	return &DecisionContextOutput{Body: out}, nil
}

// requireChiefFields turns on the fields sent, not the row, so it runs before
// the row is read.
func requireChiefFields(isChief bool, in *UpsertDecisionInput) error {
	if !isChief && (in.Body.Kind != nil || in.Body.BodyOverride != nil || in.Body.MarkSent != nil) {
		return huma.Error403Forbidden("chief role required to change the kind, override the message, or mark it sent")
	}
	return nil
}

// contextRows runs the ids back through the decisions list, which is what
// enforces access: managers get every row on their cycles, reviewers only the
// applicants they interviewed. managed marks the rows the caller manages.
func (s *decisionService) contextRows(ctx context.Context, ids []string, nuid string) ([]models.DecisionRow, map[string]bool, error) {
	managedIDs, err := s.access.VisibleApplicationIDs(ctx, ids, access.Manage)
	if err != nil {
		return nil, nil, err
	}
	reviewIDs, err := s.access.VisibleApplicationIDs(ctx, ids, access.Review)
	if err != nil {
		return nil, nil, err
	}
	managed := make(map[string]bool, len(managedIDs))
	for _, id := range managedIDs {
		managed[id] = true
	}
	reviewOnly := slices.DeleteFunc(reviewIDs, func(id string) bool { return managed[id] })

	var rows []models.DecisionRow
	for _, f := range []DecisionFilter{
		{ApplicationIDs: managedIDs},
		{ApplicationIDs: reviewOnly, InterviewerNUID: nuid},
	} {
		if len(f.ApplicationIDs) == 0 {
			continue
		}
		part, err := s.decisionDB.ListDecisions(ctx, f)
		if err != nil {
			return nil, nil, utils.StoreErr(err)
		}
		rows = append(rows, part...)
	}
	return rows, managed, nil
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

func redactPeerComments(reviews []models.InterviewReviewerDetail, nuid string) ([]models.InterviewReviewerDetail, bool) {
	redacted := false
	for i := range reviews {
		if reviews[i].ReviewerNUID != nuid && reviews[i].Writeup != nil {
			reviews[i].Writeup = nil
			redacted = true
		}
	}
	return reviews, redacted
}

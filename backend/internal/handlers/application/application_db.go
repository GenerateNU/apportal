package application

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type ApplicationDB struct {
	db *gorm.DB
}

func NewApplicationDB(db *gorm.DB) *ApplicationDB {
	return &ApplicationDB{db: db}
}

func (a *ApplicationDB) CreateApplication(ctx context.Context, in ApplicationCreate) (models.Application, error) {
	app := models.Application{
		CycleID:      in.CycleID,
		UserNUID:     in.UserNUID,
		Role:         in.Role,
		Availability: in.Availability,
		ResumeURL:    in.ResumeURL,
	}
	err := utils.Insert(a.db.WithContext(ctx), &app,
		"cycle_id", "user_nuid", "application_role", "availability", "resume_url")
	return app, err
}

// DistinctApplicationRoles returns the roles among ids within cycleID, so a
// caller can check a batch shares one role before treating it as a unit.
func (a *ApplicationDB) DistinctApplicationRoles(ctx context.Context, ids []string, cycleID string) ([]models.Role, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var roles []models.Role
	err := a.db.WithContext(ctx).Model(&models.Application{}).
		Distinct("application_role").
		Where("id IN ? AND cycle_id = ?", ids, cycleID).
		Pluck("application_role", &roles).Error
	return roles, err
}

func (a *ApplicationDB) GetApplication(ctx context.Context, id string) (models.Application, error) {
	var app models.Application
	err := a.db.WithContext(ctx).Where("id = ?", id).Take(&app).Error
	return app, utils.DBErr(err)
}

// ListApplications returns every match, unpaged, for the queues and planners
// that need the whole set.
func (a *ApplicationDB) ListApplications(ctx context.Context, f ApplicationFilter) ([]models.ApplicationSummary, error) {
	f.Limit, f.Offset = nil, 0
	items := []models.ApplicationSummary{}
	err := listApplicationsQuery(a.db.WithContext(ctx), f).Find(&items).Error
	return items, err
}

// ListApplicationsPage runs the list and, with withCounts, its total and
// per-stage counts off the same predicate so they can't disagree. The counts
// scan the whole match, so scrolling callers ask for them on the first page only.
func (a *ApplicationDB) ListApplicationsPage(ctx context.Context, f ApplicationFilter, withCounts bool) (ApplicationPage, error) {
	db := a.db.WithContext(ctx)
	page := ApplicationPage{Items: []models.ApplicationSummary{}}
	if err := listApplicationsQuery(db, f).Find(&page.Items).Error; err != nil {
		return page, err
	}
	if !withCounts {
		return page, nil
	}

	var total int64
	if err := applicationsFrom(db, f, applicationFilterAll).Distinct("a.id").Count(&total).Error; err != nil {
		return page, err
	}
	page.Total = int(total)

	var stages []struct {
		Stage models.ApplicationStage
		N     int
	}
	err := applicationsFrom(db, f, applicationFilterExceptStage).
		Select("a.stage, COUNT(DISTINCT a.id) AS n").Group("a.stage").Scan(&stages).Error
	page.StageCounts = map[models.ApplicationStage]int{}
	for _, s := range stages {
		page.StageCounts[s.Stage] = s.N
	}
	return page, err
}

func listApplicationsQuery(db *gorm.DB, f ApplicationFilter) *gorm.DB {
	q := applicationsFrom(db, f, applicationFilterAll).
		Distinct("a.id", "a.cycle_id", "a.user_nuid", "a.application_role", "a.stage", "a.availability",
			"a.resume_url", "a.submitted_at", "a.updated_at", "u.full_name", "u.email", "u.returner").
		Order("a.submitted_at DESC NULLS LAST")
	if f.Limit != nil {
		q = q.Limit(*f.Limit).Offset(f.Offset)
	}
	return q
}

type applicationFilterScope int

const (
	applicationFilterAll applicationFilterScope = iota
	// applicationFilterExceptStage omits Stage/Stages, for the per-stage counts.
	applicationFilterExceptStage
)

// applicationsFrom is the FROM/WHERE shared by the list, the total, and the
// stage counts; a predicate on one but not the others would make them disagree.
func applicationsFrom(db *gorm.DB, f ApplicationFilter, scope applicationFilterScope) *gorm.DB {
	// A valueless filter can't narrow anything and would emit an empty OR.
	answerFilters := make([]AnswerFilter, 0, len(f.AnswerFilters))
	for _, af := range f.AnswerFilters {
		if len(af.QuestionIDs) > 0 && len(af.Values) > 0 {
			answerFilters = append(answerFilters, af)
		}
	}

	q := db.Table("applications a").Joins("JOIN users u ON u.nuid = a.user_nuid")
	// The matches below sit in WHERE, which turns these into inner joins.
	for i, af := range answerFilters {
		alias := fmt.Sprintf("wa%d", i)
		q = q.Joins(fmt.Sprintf("LEFT JOIN written_answers %[1]s ON %[1]s.application_id = a.id AND %[1]s.question_id IN ?", alias), af.QuestionIDs)
	}

	if f.CycleID != "" {
		q = q.Where("a.cycle_id = ?", f.CycleID)
	}
	if f.UserNUID != "" {
		q = q.Where("a.user_nuid = ?", f.UserNUID)
	}
	if f.Role != nil {
		q = q.Where("a.application_role = ?", *f.Role)
	}
	if len(f.Roles) > 0 {
		q = q.Where("a.application_role IN ?", f.Roles)
	}
	if scope != applicationFilterExceptStage {
		if f.Stage != nil {
			q = q.Where("a.stage = ?", *f.Stage)
		}
		if len(f.Stages) > 0 {
			q = q.Where("a.stage IN ?", f.Stages)
		}
	}
	if f.Search != "" {
		pattern := "%" + utils.EscapeLike(f.Search) + "%"
		q = q.Where(`u.full_name ILIKE @p ESCAPE '\' OR a.user_nuid ILIKE @p ESCAPE '\' OR u.email ILIKE @p ESCAPE '\'`,
			map[string]any{"p": pattern})
	}
	if f.AssignedTo != "" {
		q = q.Where("EXISTS (?)", db.Table("lead_assignments la").Select("1").
			Where("la.application_id = a.id AND la.lead_nuid = ?", f.AssignedTo))
	}
	if f.InterviewerNUID != "" {
		q = q.Where("EXISTS (?)", db.Table("interview_assignments ia").Select("1").
			Where("ia.application_id = a.id AND ia.interviewer_nuid = ?", f.InterviewerNUID))
	}
	if f.RecordingReviewerNUID != "" {
		q = q.Where("EXISTS (?)", db.Table("interview_review_assignments irr").Select("1").
			Where("irr.application_id = a.id AND irr.lead_nuid = ?", f.RecordingReviewerNUID))
	}
	if len(f.InterviewRatings) > 0 {
		q = q.Where("EXISTS (?)", db.Table("interviews i").Select("1").
			Where("i.application_id = a.id AND i.rating IN ?", f.InterviewRatings))
	}
	if f.Returner != nil {
		q = q.Where("u.returner = ?", *f.Returner)
	}
	if !f.IncludeDraft {
		q = q.Where("a.stage != ?", models.StageDraft)
	}

	for i, af := range answerFilters {
		alias := fmt.Sprintf("wa%d", i)
		var clauses []string
		var args []any
		switch af.Match {
		case MatchAnyOption:
			// Containment per value, since jsonb's ?| operator would read as a placeholder.
			for _, v := range af.Values {
				clauses = append(clauses, alias+".answer_options @> jsonb_build_array(?::text)")
				args = append(args, v)
			}
		case MatchAnyOf:
			clauses = append(clauses, alias+".answer_text IN ?")
			args = append(args, af.Values)
		default:
			// OR'd substring matches, so more values widen the filter.
			for _, v := range af.Values {
				clauses = append(clauses, alias+`.answer_text ILIKE ? ESCAPE '\'`)
				args = append(args, "%"+utils.EscapeLike(v)+"%")
			}
		}
		q = q.Where(strings.Join(clauses, " OR "), args...)
	}
	return q
}

// DeleteDraftApplication discards the caller's own draft. Owner and stage are
// in the WHERE so a non-owner and a non-draft fail alike, without leaking which.
func (a *ApplicationDB) DeleteDraftApplication(ctx context.Context, id, userNUID string) error {
	res := a.db.WithContext(ctx).
		Where("id = ? AND user_nuid = ? AND stage = ?", id, userNUID, models.StageDraft).
		Delete(&models.Application{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}

// AdvanceApplicationsToLeadReview moves submitted applications into
// lead_review once a reviewer is assigned; anything past submitted is untouched.
func (a *ApplicationDB) AdvanceApplicationsToLeadReview(ctx context.Context, applicationIDs []string) (int, error) {
	if len(applicationIDs) == 0 {
		return 0, nil
	}
	res := a.db.WithContext(ctx).Model(&models.Application{}).
		Where("id IN ? AND stage = ?", applicationIDs, models.StageSubmitted).
		Update("stage", models.StageLeadReview)
	return int(res.RowsAffected), res.Error
}

// AdvanceApplicationToInterviewReview moves an application into
// interview_review when its write-up lands, but never past where a chief
// already moved it.
func (a *ApplicationDB) AdvanceApplicationToInterviewReview(ctx context.Context, applicationID string) error {
	return a.db.WithContext(ctx).Model(&models.Application{}).
		Where("id = ? AND stage IN ?", applicationID, []models.ApplicationStage{
			models.StageInterview, models.StageInterviewScheduled, models.StageInterviewConducted,
		}).
		Update("stage", models.StageInterviewReview).Error
}

func (a *ApplicationDB) UpdateApplication(ctx context.Context, id string, in ApplicationUpdate) (models.Application, error) {
	updates := map[string]any{}
	utils.SetIf(updates, "stage", in.Stage)
	utils.SetIf(updates, "resume_url", in.ResumeURL)
	if len(in.Availability) > 0 {
		updates["availability"] = models.JSONValue(in.Availability)
	}
	if in.MarkSubmitted {
		updates["submitted_at"] = gorm.Expr("NOW()")
	}
	return utils.UpdateReturning[models.Application](a.db.WithContext(ctx), updates, "id = ?", id)
}

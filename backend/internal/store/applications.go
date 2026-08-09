package store

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/GenerateNU/apportal/backend/internal/models"
)

type ApplicationCreate struct {
	CycleID      string
	UserNUID     string
	Role         models.Role
	Availability json.RawMessage
	ResumeURL    *string
}

type ApplicationUpdate struct {
	Stage        *models.ApplicationStage
	Availability json.RawMessage
	ResumeURL    *string
	// MarkSubmitted stamps submitted_at = NOW() when true. Callers should only
	// set this on an actual draft->submitted transition, never on later
	// pipeline-stage changes or plain autosaves.
	MarkSubmitted bool
}

// AnswerMatch is how an AnswerFilter compares its values against an answer.
// Which one applies is decided by the caller from the question's type, since
// where an answer lands depends on it: checkbox answers are a JSONB array in
// answer_options, every other type is a scalar in answer_text.
type AnswerMatch string

const (
	// MatchContains is a case-insensitive substring match on answer_text, for
	// free-text questions.
	MatchContains AnswerMatch = "contains"
	// MatchAnyOf matches answer_text exactly against any of the values, for
	// single-choice questions (dropdown, multiple_choice).
	MatchAnyOf AnswerMatch = "any_of"
	// MatchAnyOption matches when answer_options holds any of the values, for
	// checkbox questions.
	MatchAnyOption AnswerMatch = "any_option"
)

// AnswerFilter narrows the list to applications whose answer to one question
// matches. Values is OR'd within a filter; separate filters are AND'd.
type AnswerFilter struct {
	QuestionID string
	Match      AnswerMatch
	Values     []string
}

// ApplicationFilter holds optional list filters; empty fields are ignored.
type ApplicationFilter struct {
	CycleID  string
	UserNUID string
	Role     *models.Role
	Stage    *models.ApplicationStage
	// Stages matches any of several stages, for callers that span more than one
	// (the review pool covers both submitted and lead_review). Combined with
	// Stage it narrows further, so callers should set one or the other.
	Stages        []models.ApplicationStage
	AnswerFilters []AnswerFilter
	// AssignedTo limits results to applications the given lead is assigned to
	// write-review (via lead_assignments).
	AssignedTo string
	// IncludeDraft allows draft applications into the results. Callers should
	// only set this when listing a user's own applications by their own
	// identity — drafts are otherwise invisible (reviewer queues, admin
	// counts, etc.).
	IncludeDraft bool
	// Search matches the applicant's name, NUID, or email, case-insensitively
	// and by substring.
	Search string
	// Limit caps the page size. Nil returns every matching row — most callers
	// (assignment planning, review queues) need the whole set, so paging is
	// opt-in rather than the default.
	Limit *int
	// Offset is the 0-based index of the first row of the page. Ignored unless
	// Limit is set.
	Offset int
}

const applicationColumns = `id, cycle_id, user_nuid, application_role, stage, availability, resume_url, submitted_at, updated_at`

func (s *Store) CreateApplication(ctx context.Context, in ApplicationCreate) (models.Application, error) {
	const q = `
		INSERT INTO applications (cycle_id, user_nuid, application_role, availability, resume_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, in.CycleID, in.UserNUID, in.Role,
		jsonArg(in.Availability), in.ResumeURL)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if uniqueViolation(err) {
		return a, ErrConflict
	}
	return a, err
}

func (s *Store) GetApplication(ctx context.Context, id string) (models.Application, error) {
	const q = `SELECT ` + applicationColumns + ` FROM applications WHERE id = $1`
	rows, err := s.db.Query(ctx, q, id)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// applicationSummaryColumns matches models.ApplicationSummary's field order:
// Application's fields (positionally, per applicationColumns) followed by the
// joined applicant's full_name and email.
const applicationSummaryColumns = `a.id, a.cycle_id, a.user_nuid, a.application_role, a.stage, a.availability, a.resume_url, a.submitted_at, a.updated_at, u.full_name, u.email`

// ApplicationPage is one page of the list plus, when asked for, the totals a
// caller needs to size the scroll and label the stage tabs without a second
// request. Both counts are zero-valued when ListApplicationsPage runs without
// them, so read them from the first page rather than the latest.
type ApplicationPage struct {
	Items []models.ApplicationSummary
	// Total counts every row matching the filter, ignoring Limit/Offset.
	Total int
	// StageCounts breaks the same match down by stage, ignoring the Stage and
	// Stages filters — the tabs need to show what each stage *would* hold, so
	// counting with the active stage applied would zero out the others.
	StageCounts map[models.ApplicationStage]int
}

// ListApplications returns every row matching the filter. Paging callers want
// ListApplicationsPage instead; this stays unpaged for the queues and planners
// that need the whole set.
func (s *Store) ListApplications(ctx context.Context, f ApplicationFilter) ([]models.ApplicationSummary, error) {
	f.Limit, f.Offset = nil, 0
	query, args := listApplicationsQuery(f)
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[models.ApplicationSummary])
}

// ListApplicationsPage runs the list and, when withCounts is set, its total
// and per-stage counts off the same predicate — so the page, the result count,
// and the stage tabs can never disagree about what the filter matched.
//
// The two count queries scan the whole match rather than a page of it, so they
// dominate the request. They also can't change while the filter doesn't, which
// is why a scroll-to-load caller asks for them once on the first page and
// leaves withCounts off for the rest.
func (s *Store) ListApplicationsPage(ctx context.Context, f ApplicationFilter, withCounts bool) (ApplicationPage, error) {
	var page ApplicationPage

	query, args := listApplicationsQuery(f)
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return page, err
	}
	page.Items, err = pgx.CollectRows(rows, pgx.RowToStructByPos[models.ApplicationSummary])
	if err != nil {
		return page, err
	}
	if !withCounts {
		return page, nil
	}

	countQuery, countArgs := countApplicationsQuery(f)
	if err := s.db.QueryRow(ctx, countQuery, countArgs...).Scan(&page.Total); err != nil {
		return page, err
	}

	stageQuery, stageArgs := stageCountsQuery(f)
	stageRows, err := s.db.Query(ctx, stageQuery, stageArgs...)
	if err != nil {
		return page, err
	}
	defer stageRows.Close()
	page.StageCounts = map[models.ApplicationStage]int{}
	for stageRows.Next() {
		var stage models.ApplicationStage
		var n int
		if err := stageRows.Scan(&stage, &n); err != nil {
			return page, err
		}
		page.StageCounts[stage] = n
	}
	return page, stageRows.Err()
}

// listApplicationsQuery builds the list statement and its arguments. It is
// separate from the call above so the generated SQL — the placeholder
// numbering in particular, which shifts with every optional filter — can be
// asserted without a database.
func listApplicationsQuery(f ApplicationFilter) (string, []any) {
	query, args := applicationsFrom(f, applicationFilterAll)
	query = `SELECT DISTINCT ` + applicationSummaryColumns + query +
		` ORDER BY a.submitted_at DESC NULLS LAST`
	if f.Limit != nil {
		args = append(args, *f.Limit)
		query += ` LIMIT $` + strconv.Itoa(len(args))
		args = append(args, f.Offset)
		query += ` OFFSET $` + strconv.Itoa(len(args))
	}
	return query, args
}

// countApplicationsQuery counts what the list would return unpaged. It counts
// distinct application ids rather than rows so an answer filter's join can
// never inflate the total.
func countApplicationsQuery(f ApplicationFilter) (string, []any) {
	query, args := applicationsFrom(f, applicationFilterAll)
	return `SELECT COUNT(DISTINCT a.id)` + query, args
}

// stageCountsQuery counts the same match per stage, with the stage predicate
// itself dropped so every tab shows a live count.
func stageCountsQuery(f ApplicationFilter) (string, []any) {
	query, args := applicationsFrom(f, applicationFilterExceptStage)
	return `SELECT a.stage, COUNT(DISTINCT a.id)` + query + ` GROUP BY a.stage`, args
}

// applicationFilterScope selects which predicates applicationsFrom emits.
type applicationFilterScope int

const (
	applicationFilterAll applicationFilterScope = iota
	// applicationFilterExceptStage omits Stage/Stages, for the per-stage counts.
	applicationFilterExceptStage
)

// applicationsFrom builds everything from FROM through WHERE — the part the
// list, the total, and the stage counts must share exactly, since a predicate
// applied to one and not the others would make them contradict each other.
func applicationsFrom(f ApplicationFilter, scope applicationFilterScope) (string, []any) {
	// A valueless filter can't narrow anything and would emit an empty OR list
	// below, so drop those before they reach the query.
	answerFilters := make([]AnswerFilter, 0, len(f.AnswerFilters))
	for _, af := range f.AnswerFilters {
		if af.QuestionID == "" || len(af.Values) == 0 {
			continue
		}
		answerFilters = append(answerFilters, af)
	}

	query := ` FROM applications a JOIN users u ON u.nuid = a.user_nuid`
	args := []any{}

	// One join per answer filter, each pinned to that filter's question. The
	// match itself goes in the WHERE clause below, which is what turns these
	// into inner joins: an application with no answer to a filtered question
	// drops out.
	for i, af := range answerFilters {
		joinAlias := `wa` + strconv.Itoa(i)
		args = append(args, af.QuestionID)
		query += ` LEFT JOIN written_answers ` + joinAlias + ` ON ` + joinAlias +
			`.application_id = a.id AND ` + joinAlias + `.question_id = $` + strconv.Itoa(len(args))
	}

	query += ` WHERE 1 = 1`
	if f.CycleID != "" {
		args = append(args, f.CycleID)
		query += ` AND a.cycle_id = $` + strconv.Itoa(len(args))
	}
	if f.UserNUID != "" {
		args = append(args, f.UserNUID)
		query += ` AND a.user_nuid = $` + strconv.Itoa(len(args))
	}
	if f.Role != nil {
		args = append(args, *f.Role)
		query += ` AND a.application_role = $` + strconv.Itoa(len(args))
	}
	if scope != applicationFilterExceptStage {
		if f.Stage != nil {
			args = append(args, *f.Stage)
			query += ` AND a.stage = $` + strconv.Itoa(len(args))
		}
		if len(f.Stages) > 0 {
			stages := make([]string, len(f.Stages))
			for i, s := range f.Stages {
				stages[i] = string(s)
			}
			args = append(args, stages)
			query += ` AND a.stage = ANY($` + strconv.Itoa(len(args)) + `::application_stage[])`
		}
	}
	if f.Search != "" {
		args = append(args, "%"+escapeLike(f.Search)+"%")
		n := strconv.Itoa(len(args))
		query += ` AND (u.full_name ILIKE $` + n + ` ESCAPE '\'` +
			` OR a.user_nuid ILIKE $` + n + ` ESCAPE '\'` +
			` OR u.email ILIKE $` + n + ` ESCAPE '\')`
	}
	if f.AssignedTo != "" {
		args = append(args, f.AssignedTo)
		query += ` AND EXISTS (SELECT 1 FROM lead_assignments la` +
			` WHERE la.application_id = a.id AND la.lead_nuid = $` +
			strconv.Itoa(len(args)) + `)`
	}
	if !f.IncludeDraft {
		query += ` AND a.stage != 'draft'`
	}

	for i, af := range answerFilters {
		joinAlias := `wa` + strconv.Itoa(i)
		switch af.Match {
		case MatchAnyOption:
			// Containment per value rather than `?|` so no `?` reaches the
			// driver, where it risks being read as a placeholder.
			clauses := make([]string, 0, len(af.Values))
			for _, v := range af.Values {
				args = append(args, v)
				clauses = append(clauses, joinAlias+`.answer_options @> jsonb_build_array($`+strconv.Itoa(len(args))+`::text)`)
			}
			query += ` AND (` + strings.Join(clauses, ` OR `) + `)`
		case MatchAnyOf:
			args = append(args, af.Values)
			query += ` AND ` + joinAlias + `.answer_text = ANY($` + strconv.Itoa(len(args)) + `::text[])`
		default:
			// Each value is its own substring match, OR'd together, so a
			// multi-value text filter widens rather than contradicts itself.
			clauses := make([]string, 0, len(af.Values))
			for _, v := range af.Values {
				args = append(args, "%"+escapeLike(v)+"%")
				clauses = append(clauses, joinAlias+`.answer_text ILIKE $`+strconv.Itoa(len(args))+` ESCAPE '\'`)
			}
			query += ` AND (` + strings.Join(clauses, ` OR `) + `)`
		}
	}

	return query, args
}

// DeleteDraftApplication discards an applicant's own in-progress draft. The
// stage='draft' and user_nuid match are enforced in the WHERE clause itself
// (rather than a separate fetch-then-check) so a non-owner or a
// non-draft application both fail the same way, without leaking which.
func (s *Store) DeleteDraftApplication(ctx context.Context, id, userNUID string) error {
	tag, err := s.db.Exec(ctx,
		`DELETE FROM applications WHERE id = $1 AND user_nuid = $2 AND stage = 'draft'`,
		id, userNUID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdvanceApplicationsToLeadReview moves applications from submitted into
// lead_review once a reviewer is assigned. Guarded by stage='submitted' so
// it's a no-op for applications already past lead_review (or still draft),
// and safe to call redundantly for every assignment on an application.
func (s *Store) AdvanceApplicationsToLeadReview(ctx context.Context, applicationIDs []string) (int, error) {
	if len(applicationIDs) == 0 {
		return 0, nil
	}
	const q = `UPDATE applications SET stage = 'lead_review' WHERE id = ANY($1) AND stage = 'submitted'`
	tag, err := s.db.Exec(ctx, q, applicationIDs)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func (s *Store) UpdateApplication(ctx context.Context, id string, in ApplicationUpdate) (models.Application, error) {
	const q = `
		UPDATE applications SET
			stage        = COALESCE($2, stage),
			availability = COALESCE($3::jsonb, availability),
			resume_url   = COALESCE($4, resume_url),
			submitted_at = CASE WHEN $5 THEN NOW() ELSE submitted_at END
		WHERE id = $1
		RETURNING ` + applicationColumns
	rows, err := s.db.Query(ctx, q, id, in.Stage, jsonArg(in.Availability), in.ResumeURL, in.MarkSubmitted)
	if err != nil {
		return models.Application{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[models.Application])
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

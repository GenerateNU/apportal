package preferencelist

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/GenerateNU/apportal/backend/internal/handlers/user"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type PreferenceListDB struct {
	db    *gorm.DB
	users *user.UserDB
}

func NewPreferenceListDB(db *gorm.DB) *PreferenceListDB {
	return &PreferenceListDB{db: db, users: user.NewUserDB(db)}
}

// PreferenceListCreate carries a new list's fields. The creator joins as the
// first member, so "is a member" stays the only access check.
type PreferenceListCreate struct {
	CycleID   string
	Name      string
	CreatedBy string
}

// PreferenceListUpdate carries a partial rename/status change. Submitting
// stamps submitted_at and going back to draft clears it.
type PreferenceListUpdate struct {
	Name   *string
	Status *models.PreferenceListStatus
}

// PreferenceListEntryUpsert adds an applicant or edits their reasoning. Nil
// Reasoning keeps the stored value; "" clears it. Role scopes the rank sequence.
type PreferenceListEntryUpsert struct {
	PreferenceListID string
	ApplicationID    string
	Role             models.Role
	Reasoning        *string
	UpdatedBy        string
}

// PreferenceListPersonalEntryUpsert is PreferenceListEntryUpsert for one
// owner's personal list within the group.
type PreferenceListPersonalEntryUpsert struct {
	PreferenceListID string
	OwnerNUID        string
	ApplicationID    string
	Role             models.Role
	Reasoning        *string
}

const (
	entryDetailColumns    = "e.*, u.full_name, u.email, a.application_role, u.returner"
	personalDetailColumns = "pe.*, ou.full_name AS owner_name, au.full_name, au.email, a.application_role, au.returner"
)

func (p *PreferenceListDB) entryDetails(db *gorm.DB) *gorm.DB {
	return db.Table("preference_list_entries e").Select(entryDetailColumns).
		Joins("JOIN applications a ON a.id = e.application_id").
		Joins("JOIN users u ON u.nuid = a.user_nuid")
}

func (p *PreferenceListDB) personalEntryDetails(db *gorm.DB) *gorm.DB {
	return db.Table("preference_list_personal_entries pe").Select(personalDetailColumns).
		Joins("JOIN applications a ON a.id = pe.application_id").
		Joins("JOIN users au ON au.nuid = a.user_nuid").
		Joins("JOIN users ou ON ou.nuid = pe.owner_nuid")
}

func (p *PreferenceListDB) CreatePreferenceList(ctx context.Context, in PreferenceListCreate) (models.PreferenceList, error) {
	list := models.PreferenceList{CycleID: in.CycleID, Name: in.Name, CreatedBy: in.CreatedBy}
	err := p.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := utils.Insert(tx, &list, "cycle_id", "name", "created_by"); err != nil {
			return err
		}
		member := models.PreferenceListMember{PreferenceListID: list.ID, LeadNUID: in.CreatedBy, AddedBy: in.CreatedBy}
		return tx.Select("preference_list_id", "lead_nuid", "added_by").Create(&member).Error
	})
	return list, err
}

func (p *PreferenceListDB) GetPreferenceList(ctx context.Context, id string) (models.PreferenceList, error) {
	var list models.PreferenceList
	err := p.db.WithContext(ctx).Where("id = ?", id).Take(&list).Error
	return list, utils.DBErr(err)
}

// GetPreferenceListDetail bundles a list with its members, shared entries,
// every member's personal entries, and comments for the detail page.
func (p *PreferenceListDB) GetPreferenceListDetail(ctx context.Context, id string) (models.PreferenceListDetail, error) {
	db := p.db.WithContext(ctx)
	var detail models.PreferenceListDetail

	list, err := p.GetPreferenceList(ctx, id)
	if err != nil {
		return detail, err
	}
	detail.PreferenceList = list

	detail.Members = []models.PreferenceListMember{}
	if err := db.Where("preference_list_id = ?", id).Order("added_at").Find(&detail.Members).Error; err != nil {
		return detail, err
	}
	detail.Entries = []models.PreferenceListEntryDetail{}
	if err := p.entryDetails(db).Where("e.preference_list_id = ?", id).Order("e.rank").Find(&detail.Entries).Error; err != nil {
		return detail, err
	}
	detail.PersonalEntries = []models.PreferenceListPersonalEntryDetail{}
	err = p.personalEntryDetails(db).Where("pe.preference_list_id = ?", id).
		Order("pe.owner_nuid").Order("pe.rank").Find(&detail.PersonalEntries).Error
	if err != nil {
		return detail, err
	}
	detail.Comments, err = p.ListPreferenceListComments(ctx, id)
	return detail, err
}

// ListPreferenceListDetails returns every group in a cycle with its full
// detail, in a fixed number of queries, for the chief's side-by-side view.
func (p *PreferenceListDB) ListPreferenceListDetails(ctx context.Context, cycleID string) ([]models.PreferenceListDetail, error) {
	db := p.db.WithContext(ctx)
	var lists []models.PreferenceList
	if err := db.Where("cycle_id = ?", cycleID).Order("created_at DESC").Find(&lists).Error; err != nil {
		return nil, err
	}
	if len(lists) == 0 {
		return []models.PreferenceListDetail{}, nil
	}
	ids := make([]string, len(lists))
	for i, l := range lists {
		ids[i] = l.ID
	}

	var members []models.PreferenceListMember
	err := db.Where("preference_list_id IN ?", ids).Order("preference_list_id").Order("added_at").Find(&members).Error
	if err != nil {
		return nil, err
	}
	membersByList := map[string][]models.PreferenceListMember{}
	for _, m := range members {
		membersByList[m.PreferenceListID] = append(membersByList[m.PreferenceListID], m)
	}

	var entries []models.PreferenceListEntryDetail
	err = p.entryDetails(db).Where("e.preference_list_id IN ?", ids).
		Order("e.preference_list_id").Order("e.rank").Find(&entries).Error
	if err != nil {
		return nil, err
	}
	entriesByList := map[string][]models.PreferenceListEntryDetail{}
	for _, e := range entries {
		entriesByList[e.PreferenceListID] = append(entriesByList[e.PreferenceListID], e)
	}

	var personalEntries []models.PreferenceListPersonalEntryDetail
	err = p.personalEntryDetails(db).Where("pe.preference_list_id IN ?", ids).
		Order("pe.preference_list_id").Order("pe.owner_nuid").Order("pe.rank").Find(&personalEntries).Error
	if err != nil {
		return nil, err
	}
	personalByList := map[string][]models.PreferenceListPersonalEntryDetail{}
	for _, pe := range personalEntries {
		personalByList[pe.PreferenceListID] = append(personalByList[pe.PreferenceListID], pe)
	}

	var comments []models.PreferenceListComment
	err = db.Where("preference_list_id IN ?", ids).Order("preference_list_id").Order("created_at").Find(&comments).Error
	if err != nil {
		return nil, err
	}
	details, err := p.withAuthorNames(ctx, comments)
	if err != nil {
		return nil, err
	}
	commentsByList := map[string][]models.PreferenceListCommentDetail{}
	for _, c := range details {
		commentsByList[c.PreferenceListID] = append(commentsByList[c.PreferenceListID], c)
	}

	out := make([]models.PreferenceListDetail, len(lists))
	for i, l := range lists {
		out[i] = models.PreferenceListDetail{
			PreferenceList:  l,
			Members:         membersByList[l.ID],
			Entries:         entriesByList[l.ID],
			PersonalEntries: personalByList[l.ID],
			Comments:        commentsByList[l.ID],
		}
	}
	return out, nil
}

// ListPreferenceLists returns a cycle's groups. Without includeAll, only
// groups memberNUID belongs to; others shouldn't even reveal their names.
func (p *PreferenceListDB) ListPreferenceLists(ctx context.Context, cycleID string, memberNUID string, includeAll bool) ([]models.PreferenceListSummary, error) {
	db := p.db.WithContext(ctx)
	q := db.Table("preference_lists pl").
		Select("pl.*, COUNT(DISTINCT m.id) AS member_count, COUNT(DISTINCT e.id) AS entry_count, "+
			"COALESCE(array_agg(DISTINCT u.full_name) FILTER (WHERE u.full_name IS NOT NULL), '{}')::text[] AS member_names").
		Joins("LEFT JOIN preference_list_members m ON m.preference_list_id = pl.id").
		Joins("LEFT JOIN users u ON u.nuid = m.lead_nuid").
		Joins("LEFT JOIN preference_list_entries e ON e.preference_list_id = pl.id").
		Where("pl.cycle_id = ?", cycleID)
	if !includeAll {
		q = q.Where("EXISTS (?)", db.Table("preference_list_members m2").Select("1").
			Where("m2.preference_list_id = pl.id AND m2.lead_nuid = ?", memberNUID))
	}
	summaries := []models.PreferenceListSummary{}
	err := q.Group("pl.id").Order("pl.created_at DESC").Find(&summaries).Error
	return summaries, err
}

func (p *PreferenceListDB) UpdatePreferenceList(ctx context.Context, id string, in PreferenceListUpdate) (models.PreferenceList, error) {
	updates := map[string]any{"updated_at": gorm.Expr("NOW()")}
	utils.SetIf(updates, "name", in.Name)
	if in.Status != nil {
		updates["status"] = *in.Status
		switch *in.Status {
		case models.PreferenceListSubmitted:
			updates["submitted_at"] = gorm.Expr("NOW()")
		case models.PreferenceListDraft:
			updates["submitted_at"] = nil
		}
	}
	return utils.UpdateReturning[models.PreferenceList](p.db.WithContext(ctx), updates, "id = ?", id)
}

// UpdatePreferenceListMeetingDay sets or clears the members' meeting day. It
// is separate from UpdatePreferenceList, where nil means "leave it".
func (p *PreferenceListDB) UpdatePreferenceListMeetingDay(ctx context.Context, id string, meetingDay *string) (models.PreferenceList, error) {
	return utils.UpdateReturning[models.PreferenceList](p.db.WithContext(ctx),
		map[string]any{"meeting_day": meetingDay, "updated_at": gorm.Expr("NOW()")}, "id = ?", id)
}

func (p *PreferenceListDB) DeletePreferenceList(ctx context.Context, id string) error {
	return deleteOne(p.db.WithContext(ctx).Where("id = ?", id), &models.PreferenceList{})
}

func (p *PreferenceListDB) IsPreferenceListMember(ctx context.Context, listID, nuid string) (bool, error) {
	var n int64
	err := p.db.WithContext(ctx).Model(&models.PreferenceListMember{}).
		Where("preference_list_id = ? AND lead_nuid = ?", listID, nuid).Count(&n).Error
	return n > 0, err
}

func (p *PreferenceListDB) AddPreferenceListMember(ctx context.Context, listID, leadNUID, addedBy string) (models.PreferenceListMember, error) {
	member := models.PreferenceListMember{PreferenceListID: listID, LeadNUID: leadNUID, AddedBy: addedBy}
	err := utils.Insert(p.db.WithContext(ctx), &member, "preference_list_id", "lead_nuid", "added_by")
	return member, err
}

// CountPreferenceListMembers backs the handler's member cap, which lives in
// code rather than a constraint so it's easy to change.
func (p *PreferenceListDB) CountPreferenceListMembers(ctx context.Context, listID string) (int, error) {
	var n int64
	err := p.db.WithContext(ctx).Model(&models.PreferenceListMember{}).Where("preference_list_id = ?", listID).Count(&n).Error
	return int(n), err
}

// RemovePreferenceListMember is scoped to the list so a member id from one
// list can't remove a row on another.
func (p *PreferenceListDB) RemovePreferenceListMember(ctx context.Context, listID, memberID string) error {
	return deleteOne(p.db.WithContext(ctx).Where("id = ? AND preference_list_id = ?", memberID, listID),
		&models.PreferenceListMember{})
}

// GetOrCreatePreferenceListDeadline fetches the (cycle, role) deadline,
// creating an unset one (editable indefinitely) on first access.
func (p *PreferenceListDB) GetOrCreatePreferenceListDeadline(ctx context.Context, cycleID string, role models.Role) (models.PreferenceListDeadline, error) {
	db := p.db.WithContext(ctx)
	var deadline models.PreferenceListDeadline
	err := db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&deadline).Error
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return deadline, err
	}

	deadline = models.PreferenceListDeadline{CycleID: cycleID, ApplicationRole: role}
	res := db.Select("cycle_id", "application_role").
		Clauses(clause.OnConflict{DoNothing: true}, clause.Returning{}).Create(&deadline)
	if res.Error != nil || res.RowsAffected > 0 {
		return deadline, res.Error
	}

	// Lost a race with a concurrent create; read what the other writer inserted.
	deadline = models.PreferenceListDeadline{}
	err = db.Where("cycle_id = ? AND application_role = ?", cycleID, role).Take(&deadline).Error
	return deadline, err
}

// UpsertPreferenceListDeadline sets or clears (nil) the (cycle, role) deadline.
func (p *PreferenceListDB) UpsertPreferenceListDeadline(ctx context.Context, cycleID string, role models.Role, closesAt *time.Time, updatedBy string) (models.PreferenceListDeadline, error) {
	deadline := models.PreferenceListDeadline{CycleID: cycleID, ApplicationRole: role, ClosesAt: closesAt, UpdatedBy: &updatedBy}
	err := p.db.WithContext(ctx).Select("cycle_id", "application_role", "closes_at", "updated_by").
		Clauses(
			clause.OnConflict{
				Columns: []clause.Column{{Name: "cycle_id"}, {Name: "application_role"}},
				DoUpdates: append(
					clause.AssignmentColumns([]string{"closes_at", "updated_by"}),
					clause.Assignment{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
				),
			},
			clause.Returning{},
		).
		Create(&deadline).Error
	return deadline, err
}

// lockList serializes rank assignment within a list: two concurrent adds
// would otherwise read the same MAX(rank) and collide.
func lockList(tx *gorm.DB, listID string) error {
	var list models.PreferenceList
	return tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", listID).Take(&list).Error
}

// UpsertPreferenceListEntry appends a new entry to its role's rank order, or
// edits an existing entry's reasoning without touching its rank, so it can't
// clobber a concurrent reorder.
func (p *PreferenceListDB) UpsertPreferenceListEntry(ctx context.Context, in PreferenceListEntryUpsert) (models.PreferenceListEntry, error) {
	entry := models.PreferenceListEntry{
		PreferenceListID: in.PreferenceListID,
		ApplicationID:    in.ApplicationID,
		Reasoning:        in.Reasoning,
		UpdatedBy:        in.UpdatedBy,
	}
	err := p.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockList(tx, in.PreferenceListID); err != nil {
			return utils.DBErr(err)
		}
		err := tx.Table("preference_list_entries e").
			Joins("JOIN applications a ON a.id = e.application_id").
			Where("e.preference_list_id = ? AND a.application_role = ?", in.PreferenceListID, in.Role).
			Select("COALESCE(MAX(e.rank), 0) + 1").Scan(&entry.Rank).Error
		if err != nil {
			return err
		}
		return tx.Select("preference_list_id", "application_id", "rank", "reasoning", "updated_by").
			Clauses(
				clause.OnConflict{
					Columns: []clause.Column{{Name: "preference_list_id"}, {Name: "application_id"}},
					DoUpdates: clause.Set{
						{Column: clause.Column{Name: "reasoning"}, Value: gorm.Expr("COALESCE(EXCLUDED.reasoning, preference_list_entries.reasoning)")},
						{Column: clause.Column{Name: "updated_by"}, Value: clause.Column{Table: "excluded", Name: "updated_by"}},
						{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
					},
				},
				clause.Returning{},
			).
			Create(&entry).Error
	})
	return entry, err
}

func (p *PreferenceListDB) DeletePreferenceListEntry(ctx context.Context, listID, applicationID string) error {
	return deleteOne(p.db.WithContext(ctx).Where("preference_list_id = ? AND application_id = ?", listID, applicationID),
		&models.PreferenceListEntry{})
}

// ListPreferenceListEntryApplicationIDs returns one role's entry ids, so the
// handler can check a reorder is an exact permutation of them.
func (p *PreferenceListDB) ListPreferenceListEntryApplicationIDs(ctx context.Context, listID string, role models.Role) ([]string, error) {
	var ids []string
	err := p.db.WithContext(ctx).Table("preference_list_entries e").
		Joins("JOIN applications a ON a.id = e.application_id").
		Where("e.preference_list_id = ? AND a.application_role = ?", listID, role).
		Pluck("e.application_id", &ids).Error
	return ids, err
}

// rankByPosition maps each application id to its 1-based position in one
// CASE, so a reorder stays a single UPDATE.
func rankByPosition(orderedApplicationIDs []string) clause.Expr {
	var sql strings.Builder
	sql.WriteString("CASE application_id")
	args := make([]any, len(orderedApplicationIDs))
	for i, id := range orderedApplicationIDs {
		fmt.Fprintf(&sql, " WHEN ? THEN %d", i+1)
		args[i] = id
	}
	sql.WriteString(" ELSE rank END")
	return gorm.Expr(sql.String(), args...)
}

// ReorderPreferenceListEntries sets rank to each entry's position in the order.
func (p *PreferenceListDB) ReorderPreferenceListEntries(ctx context.Context, listID string, orderedApplicationIDs []string) error {
	if len(orderedApplicationIDs) == 0 {
		return nil
	}
	return p.db.WithContext(ctx).Model(&models.PreferenceListEntry{}).
		Where("preference_list_id = ? AND application_id IN ?", listID, orderedApplicationIDs).
		UpdateColumns(map[string]any{"rank": rankByPosition(orderedApplicationIDs), "updated_at": gorm.Expr("NOW()")}).Error
}

// UpsertPersonalPreferenceListEntry is UpsertPreferenceListEntry for one
// owner's personal list, whose ranks run 1..N per (list, owner, role).
func (p *PreferenceListDB) UpsertPersonalPreferenceListEntry(ctx context.Context, in PreferenceListPersonalEntryUpsert) (models.PreferenceListPersonalEntry, error) {
	entry := models.PreferenceListPersonalEntry{
		PreferenceListID: in.PreferenceListID,
		OwnerNUID:        in.OwnerNUID,
		ApplicationID:    in.ApplicationID,
		Reasoning:        in.Reasoning,
	}
	err := p.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockList(tx, in.PreferenceListID); err != nil {
			return utils.DBErr(err)
		}
		err := tx.Table("preference_list_personal_entries pe").
			Joins("JOIN applications a ON a.id = pe.application_id").
			Where("pe.preference_list_id = ? AND pe.owner_nuid = ? AND a.application_role = ?", in.PreferenceListID, in.OwnerNUID, in.Role).
			Select("COALESCE(MAX(pe.rank), 0) + 1").Scan(&entry.Rank).Error
		if err != nil {
			return err
		}
		return tx.Select("preference_list_id", "owner_nuid", "application_id", "rank", "reasoning").
			Clauses(
				clause.OnConflict{
					Columns: []clause.Column{{Name: "preference_list_id"}, {Name: "owner_nuid"}, {Name: "application_id"}},
					DoUpdates: clause.Set{
						{Column: clause.Column{Name: "reasoning"}, Value: gorm.Expr("COALESCE(EXCLUDED.reasoning, preference_list_personal_entries.reasoning)")},
						{Column: clause.Column{Name: "updated_at"}, Value: gorm.Expr("NOW()")},
					},
				},
				clause.Returning{},
			).
			Create(&entry).Error
	})
	return entry, err
}

func (p *PreferenceListDB) DeletePersonalPreferenceListEntry(ctx context.Context, listID, ownerNUID, applicationID string) error {
	return deleteOne(p.db.WithContext(ctx).
		Where("preference_list_id = ? AND owner_nuid = ? AND application_id = ?", listID, ownerNUID, applicationID),
		&models.PreferenceListPersonalEntry{})
}

// ListPersonalPreferenceListEntryApplicationIDs returns one owner's entry ids
// for one role, to validate a personal reorder.
func (p *PreferenceListDB) ListPersonalPreferenceListEntryApplicationIDs(ctx context.Context, listID, ownerNUID string, role models.Role) ([]string, error) {
	var ids []string
	err := p.db.WithContext(ctx).Table("preference_list_personal_entries pe").
		Joins("JOIN applications a ON a.id = pe.application_id").
		Where("pe.preference_list_id = ? AND pe.owner_nuid = ? AND a.application_role = ?", listID, ownerNUID, role).
		Pluck("pe.application_id", &ids).Error
	return ids, err
}

func (p *PreferenceListDB) ReorderPersonalPreferenceListEntries(ctx context.Context, listID, ownerNUID string, orderedApplicationIDs []string) error {
	if len(orderedApplicationIDs) == 0 {
		return nil
	}
	return p.db.WithContext(ctx).Model(&models.PreferenceListPersonalEntry{}).
		Where("preference_list_id = ? AND owner_nuid = ? AND application_id IN ?", listID, ownerNUID, orderedApplicationIDs).
		UpdateColumns(map[string]any{"rank": rankByPosition(orderedApplicationIDs), "updated_at": gorm.Expr("NOW()")}).Error
}

// CreatePreferenceListComment adds a comment on the group (nil applicationID)
// or on one entry.
func (p *PreferenceListDB) CreatePreferenceListComment(ctx context.Context, listID string, applicationID *string, authorNUID, body string) (models.PreferenceListCommentDetail, error) {
	comment := models.PreferenceListComment{PreferenceListID: listID, ApplicationID: applicationID, AuthorNUID: authorNUID, Body: body}
	err := utils.Insert(p.db.WithContext(ctx), &comment, "preference_list_id", "application_id", "author_nuid", "body")
	if err != nil {
		return models.PreferenceListCommentDetail{}, err
	}
	details, err := p.withAuthorNames(ctx, []models.PreferenceListComment{comment})
	if err != nil {
		return models.PreferenceListCommentDetail{}, err
	}
	return details[0], nil
}

// UpdatePreferenceListComment edits the author's own comment within listID.
// ErrNotFound covers missing, not yours, and wrong list alike.
func (p *PreferenceListDB) UpdatePreferenceListComment(ctx context.Context, listID, commentID, authorNUID, body string) (models.PreferenceListCommentDetail, error) {
	comment, err := utils.UpdateReturning[models.PreferenceListComment](p.db.WithContext(ctx),
		map[string]any{"body": body, "updated_at": gorm.Expr("NOW()")}, "id = ? AND preference_list_id = ? AND author_nuid = ?", commentID, listID, authorNUID)
	if err != nil {
		return models.PreferenceListCommentDetail{}, err
	}
	details, err := p.withAuthorNames(ctx, []models.PreferenceListComment{comment})
	if err != nil {
		return models.PreferenceListCommentDetail{}, err
	}
	return details[0], nil
}

// ListPreferenceListComments returns a list's group and entry comments, oldest first.
func (p *PreferenceListDB) ListPreferenceListComments(ctx context.Context, listID string) ([]models.PreferenceListCommentDetail, error) {
	var comments []models.PreferenceListComment
	if err := p.db.WithContext(ctx).Where("preference_list_id = ?", listID).Order("created_at").Find(&comments).Error; err != nil {
		return nil, err
	}
	return p.withAuthorNames(ctx, comments)
}

func (p *PreferenceListDB) withAuthorNames(ctx context.Context, comments []models.PreferenceListComment) ([]models.PreferenceListCommentDetail, error) {
	nuids := make([]string, len(comments))
	for i, c := range comments {
		nuids[i] = c.AuthorNUID
	}
	names, err := p.users.NamesByNUIDs(ctx, nuids)
	if err != nil {
		return nil, err
	}
	details := make([]models.PreferenceListCommentDetail, len(comments))
	for i, c := range comments {
		details[i] = models.PreferenceListCommentDetail{PreferenceListComment: c, AuthorName: names[c.AuthorNUID]}
	}
	return details, nil
}

func deleteOne(q *gorm.DB, model any) error {
	res := q.Delete(model)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return utils.ErrNotFound
	}
	return nil
}

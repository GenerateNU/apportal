package access

import (
	"context"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
	"github.com/GenerateNU/apportal/backend/internal/workflow"
)

type Readable struct {
	IDs []string
	// Peers is true where the caller also sees other reviewers' work, not just their own.
	Peers map[string]bool
}

func (r Readable) Has(id string) bool {
	for _, x := range r.IDs {
		if x == id {
			return true
		}
	}
	return false
}

// Work that stays blind to other reviewers until a chief releases it.
var blindWork = map[workflow.Work]models.ReviewKind{
	workflow.WorkWrittenReview:   models.ReviewKindWritten,
	workflow.WorkRecordingReview: models.ReviewKindRecording,
}

// Readable narrows ids to the applications the caller holds want on, whose cycle runs the step that owns w.
func (c *Checker) Readable(ctx context.Context, ids []string, want Level, w workflow.Work) (Readable, error) {
	out := Readable{IDs: []string{}, Peers: map[string]bool{}}
	ids, err := c.VisibleApplicationIDs(ctx, ids, want)
	if err != nil || len(ids) == 0 {
		return out, err
	}
	if out.IDs, err = workflow.NewService(c.db).VisibleApplications(ctx, ids, w); err != nil {
		return out, utils.StoreErr(err)
	}
	kind, blind := blindWork[w]
	if !blind {
		for _, id := range out.IDs {
			out.Peers[id] = true
		}
		return out, nil
	}
	managed, err := c.VisibleApplicationIDs(ctx, out.IDs, Manage)
	if err != nil {
		return out, err
	}
	for _, id := range managed {
		out.Peers[id] = true
	}
	var released []string
	err = c.db.WithContext(ctx).Table("applications a").
		Joins("JOIN review_releases r ON r.cycle_id = a.cycle_id AND r.role_id = a.role_id").
		Where("a.id IN ? AND r.review_kind = ?", out.IDs, kind).
		Pluck("a.id", &released).Error
	if err != nil {
		return out, utils.StoreErr(err)
	}
	for _, id := range released {
		out.Peers[id] = true
	}
	return out, nil
}

// CanRead 403s or 404s like CanApplication, then narrows to whether the cycle runs w.
func (c *Checker) CanRead(ctx context.Context, applicationID string, action ApplicationAction, want Level, w workflow.Work) (Readable, error) {
	if err := c.CanApplication(ctx, action, applicationID); err != nil {
		return Readable{}, err
	}
	return c.Readable(ctx, []string{applicationID}, want, w)
}

func (r Readable) Split() (peers, ownOnly []string) {
	for _, id := range r.IDs {
		if r.Peers[id] {
			peers = append(peers, id)
		} else {
			ownOnly = append(ownOnly, id)
		}
	}
	return peers, ownOnly
}

// HidePeerWriteups clears other reviewers' write-ups where the caller only sees their own, reporting whether any were hidden.
func (r Readable) HidePeerWriteups(items []models.InterviewReviewerDetail, nuid string) bool {
	hid := false
	for i := range items {
		if !r.Peers[items[i].ApplicationID] && items[i].ReviewerNUID != nuid && items[i].Writeup != nil {
			items[i].Writeup = nil
			hid = true
		}
	}
	return hid
}

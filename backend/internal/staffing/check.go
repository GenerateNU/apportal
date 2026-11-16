package staffing

import (
	"errors"
	"slices"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

type Applicant struct {
	ApplicationID string
	CycleID       string
	RoleID        string
	ApplicantNUID string
	Stage         models.ApplicationStage
	Assigned      map[models.StaffKind][]string
	Conflicted    map[string]bool
}

func (a Applicant) Has(kind models.StaffKind, nuid string) bool {
	return slices.Contains(a.Assigned[kind], nuid)
}

var (
	ErrLocked      = errors.New("assignments for this opening are locked")
	ErrOff         = errors.New("this cycle doesn't use this kind of assignment")
	ErrNotEligible = errors.New("this person isn't on this opening's team for this work")
	ErrConflicted  = errors.New("this person has a conflict of interest with this applicant")
	ErrSamePerson  = errors.New("the same person can't both interview this applicant and review their recording")
	ErrFull        = errors.New("this applicant already has enough people for this")
	ErrAlready     = errors.New("this person is already assigned")
)

// Rules is one opening's settings, as the check sees them.
type Rules struct {
	Released bool
	Limit    int
	Eligible []string
}

// Check is the one rule check in front of every interviewer, recording
// reviewer and (later) reviewer add.
func Check(a Applicant, r Rules, nuid string, kind models.StaffKind) error {
	switch {
	case r.Released:
		return ErrLocked
	case r.Limit <= 0:
		return ErrOff
	case a.Has(kind, nuid):
		return ErrAlready
	case !slices.Contains(r.Eligible, nuid):
		return ErrNotEligible
	case a.Conflicted[nuid]:
		return ErrConflicted
	case kind == models.KindInterviewer && a.Has(models.KindRecordingReviewer, nuid),
		kind == models.KindRecordingReviewer && a.Has(models.KindInterviewer, nuid):
		return ErrSamePerson
	case len(a.Assigned[kind]) >= r.Limit:
		return ErrFull
	}
	return nil
}

func HTTPError(err error) error {
	switch {
	case errors.Is(err, ErrOff), errors.Is(err, ErrNotEligible):
		return huma.Error422UnprocessableEntity(err.Error())
	case errors.Is(err, ErrLocked), errors.Is(err, ErrConflicted), errors.Is(err, ErrSamePerson),
		errors.Is(err, ErrFull), errors.Is(err, ErrAlready):
		return huma.Error409Conflict(err.Error())
	}
	return utils.StoreErr(err)
}

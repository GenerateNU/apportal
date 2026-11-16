package staffing

import (
	"errors"
	"fmt"
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
	Assigned      map[models.StepKind][]string
	Conflicted    map[string]bool
}

func (a Applicant) Has(kind models.StepKind, nuid string) bool {
	return slices.Contains(a.Assigned[kind], nuid)
}

var (
	ErrLocked      = errors.New("interviews are released for this opening, so its assignments are locked")
	ErrOff         = errors.New("this cycle doesn't use this kind of assignment")
	ErrNotEligible = errors.New("this person isn't on this opening's team for this work")
	ErrConflicted  = errors.New("this person has a conflict of interest with this applicant")
	ErrSamePerson  = errors.New("the same person can't both interview this applicant and review their recording")
	ErrFull        = errors.New("this applicant already has enough people for this")
	ErrAlready     = errors.New("this person is already assigned")
	ErrUnset       = errors.New("the per-applicant count isn't set")
)

func unset(kind models.StepKind) error {
	return fmt.Errorf("%w: set %ss each first", ErrUnset, kind)
}

type Rules struct {
	Frozen   error
	Released bool
	Limit    int
	Eligible []string
}

func (r Rules) RequireLimit(kind models.StepKind) error {
	if r.Limit <= 0 && kind != models.KindRecordingReviewer {
		return unset(kind)
	}
	return nil
}

func Check(a Applicant, r Rules, nuid string, kind models.StepKind) error {
	switch {
	case r.Frozen != nil:
		return r.Frozen
	case r.Released:
		return ErrLocked
	case r.RequireLimit(kind) != nil:
		return r.RequireLimit(kind)
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
	var se huma.StatusError
	switch {
	case err == nil, errors.As(err, &se):
		return err
	case errors.Is(err, ErrUnset):
		return huma.Error409Conflict(err.Error())
	case errors.Is(err, ErrOff), errors.Is(err, ErrNotEligible), errors.Is(err, ErrNotStaffKind):
		return huma.Error422UnprocessableEntity(err.Error())
	case errors.Is(err, ErrLocked), errors.Is(err, ErrConflicted), errors.Is(err, ErrSamePerson),
		errors.Is(err, ErrFull), errors.Is(err, ErrAlready):
		return huma.Error409Conflict(err.Error())
	}
	return utils.StoreErr(err)
}

package cycle

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

var admin = middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleAdmin}}

func TestCycleCreateRequiresActor(t *testing.T) {
	s := &cycleService{}
	in := &CreateCycleInput{}
	in.Body.Name = "Fall 2026"
	in.Body.BranchID = "b1"

	_, err := s.create(context.Background(), in)
	testutil.WantStatus(t, err, http.StatusUnauthorized)
}

func TestCycleCreateRequiresBranch(t *testing.T) {
	s := &cycleService{}
	in := &CreateCycleInput{}
	in.Body.Name = "Fall 2026"

	_, err := s.create(testutil.WithActor(admin), in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestArchiveOnly(t *testing.T) {
	cases := []struct {
		from, to models.CycleStatus
		want     int
	}{
		{models.CycleClosed, models.CycleArchived, 0},
		{models.CycleArchived, models.CycleClosed, 0},
		{models.CycleOpen, models.CycleOpen, 0},
		{models.CycleDraft, models.CycleOpen, http.StatusConflict},
		{models.CycleOpen, models.CycleClosed, http.StatusConflict},
		{models.CycleClosed, models.CycleOpen, http.StatusConflict},
		{models.CycleOpen, models.CycleArchived, http.StatusConflict},
		{models.CycleClosed, "finished", http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		err := archiveOnly(tc.from, tc.to)
		if tc.want == 0 {
			if err != nil {
				t.Errorf("%s -> %s: %v", tc.from, tc.to, err)
			}
			continue
		}
		testutil.WantStatus(t, err, tc.want)
	}
}

package tag

import (
	"context"
	"net/http"
	"testing"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// Only the rejection paths, which return before the database is touched.

var (
	leadCtx      = testutil.WithActor(middleware.Actor{NUID: "l1", Roles: []models.UserRole{models.UserRoleLead}})
	applicantCtx = testutil.WithActor(middleware.Actor{NUID: "a1", Roles: []models.UserRole{models.UserRoleApplicant}})
)

func TestTagRoutesRequireReviewer(t *testing.T) {
	s := &tagService{}
	for name, call := range map[string]func(ctx context.Context) error{
		"list":   func(ctx context.Context) error { _, err := s.list(ctx, &utils.CycleScopedInput{}); return err },
		"create": func(ctx context.Context) error { _, err := s.create(ctx, &CreateTagInput{}); return err },
		"update": func(ctx context.Context) error { _, err := s.update(ctx, &UpdateTagInput{}); return err },
		"delete": func(ctx context.Context) error { _, err := s.delete(ctx, &utils.IDInput{}); return err },
		"set":    func(ctx context.Context) error { _, err := s.setApplicationTags(ctx, &SetApplicationTagsInput{}); return err },
	} {
		t.Run(name, func(t *testing.T) {
			testutil.WantStatus(t, call(context.Background()), http.StatusUnauthorized)
			testutil.WantStatus(t, call(applicantCtx), http.StatusUnauthorized)
		})
	}
}

func TestCreateRejectsBadNames(t *testing.T) {
	s := &tagService{}
	long := make([]rune, maxNameLen+1)
	for i := range long {
		long[i] = 'a'
	}
	for _, name := range []string{"", "   ", string(long)} {
		in := &CreateTagInput{}
		in.Body.Name = name
		_, err := s.create(leadCtx, in)
		testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
	}
}

func TestUpdateRejectsUnknownColor(t *testing.T) {
	s := &tagService{}
	color := "chartreuse"
	in := &UpdateTagInput{}
	in.Body.Color = &color
	_, err := s.update(leadCtx, in)
	testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
}

func TestSetApplicationTagsRejectsOverCapAndDuplicates(t *testing.T) {
	s := &tagService{}
	for name, ids := range map[string][]string{
		"over cap":   {"a", "b", "c", "d"},
		"duplicates": {"a", "a"},
	} {
		t.Run(name, func(t *testing.T) {
			in := &SetApplicationTagsInput{}
			in.Body.TagIDs = ids
			_, err := s.setApplicationTags(leadCtx, in)
			testutil.WantStatus(t, err, http.StatusUnprocessableEntity)
		})
	}
}

func TestCleanNameCollapsesWhitespace(t *testing.T) {
	got, err := cleanName("  Mentor   candidate ")
	if err != nil || got != "Mentor candidate" {
		t.Fatalf("got %q, %v", got, err)
	}
}

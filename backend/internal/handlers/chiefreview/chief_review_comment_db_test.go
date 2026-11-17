package chiefreview

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func TestCommentEditStaysOnItsApplication(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	chief, applicant := "t"+uuid.NewString()[:12], "t"+uuid.NewString()[:12]
	for _, n := range []string{chief, applicant} {
		exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", n, n+"@test.example", n)
	}
	branch, cycle, role := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'Test', 'open', 'member')", cycle, branch)
	exec("INSERT INTO roles (id, cycle_id, name) VALUES (?, ?, 'Engineer'), (?, ?, 'Designer')", role, cycle, uuid.NewString(), cycle)
	inURL, owning := uuid.NewString(), uuid.NewString()
	other := "t" + uuid.NewString()[:12]
	exec("INSERT INTO users (nuid, email, full_name) VALUES (?, ?, ?)", other, other+"@test.example", other)
	exec("INSERT INTO applications (id, cycle_id, user_nuid, role_id, stage) VALUES (?, ?, ?, ?, 'chief_review'), (?, ?, ?, ?, 'chief_review')",
		inURL, cycle, applicant, role, owning, cycle, other, role)
	comment := uuid.NewString()
	exec("INSERT INTO chief_review_comments (id, application_id, author_nuid, body) VALUES (?, ?, ?, 'original')", comment, owning, chief)

	store := NewChiefReviewDB(db)
	if _, err := store.UpdateChiefReviewComment(context.Background(), inURL, comment, chief, "changed"); err == nil {
		t.Fatal("a comment can't be edited through another application's URL")
	}
	var body string
	db.Raw("SELECT body FROM chief_review_comments WHERE id = ?", comment).Scan(&body)
	if body != "original" {
		t.Fatalf("comment changed to %q", body)
	}
	if _, err := store.UpdateChiefReviewComment(context.Background(), owning, comment, chief, "changed"); err != nil {
		t.Fatalf("editing through its own application works: %v", err)
	}
}

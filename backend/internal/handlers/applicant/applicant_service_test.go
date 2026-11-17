package applicant

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/access"
	"github.com/GenerateNU/apportal/backend/internal/middleware"
	"github.com/GenerateNU/apportal/backend/internal/models"
	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

func session(email string, actor *middleware.Actor) context.Context {
	ctx := middleware.ContextWithVerifiedEmail(context.Background(), email)
	if actor != nil {
		ctx = middleware.ContextWithActor(ctx, *actor)
	}
	return ctx
}

func profile(nuid, email, name string) *UpsertApplicantInput {
	in := &UpsertApplicantInput{}
	in.Body.NUID, in.Body.Email, in.Body.FullName = nuid, email, name
	return in
}

func TestUpsertApplicantCannotTakeOverAccounts(t *testing.T) {
	db := testutil.TestDB(t)
	s := &applicantService{access: access.NewChecker(db), applicantDB: NewApplicantDB(db)}
	id := func() string { return "t" + uuid.NewString()[:12] }
	admin, attacker := id(), id()
	adminEmail, attackerEmail := admin+"@northeastern.edu", attacker+"@northeastern.edu"
	if err := db.Exec("INSERT INTO users (nuid, email, full_name, roles) VALUES (?, ?, 'Admin', '{admin}')", admin, adminEmail).Error; err != nil {
		t.Fatal(err)
	}
	emailOf := func(nuid string) string {
		var e string
		db.Raw("SELECT email FROM users WHERE nuid = ?", nuid).Scan(&e)
		return e
	}

	_, err := s.upsert(context.Background(), profile(admin, attackerEmail, "x"))
	testutil.WantStatus(t, err, http.StatusUnauthorized)

	_, err = s.upsert(session(attackerEmail, nil), profile(admin, adminEmail, "x"))
	testutil.WantStatus(t, err, http.StatusForbidden)

	_, err = s.upsert(session(attackerEmail, nil), profile(admin, attackerEmail, "x"))
	testutil.WantStatus(t, err, http.StatusConflict)
	if emailOf(admin) != adminEmail {
		t.Fatal("a new account must never move an existing user's email")
	}

	out, err := s.upsert(session(attackerEmail, nil), profile(attacker, attackerEmail, "Me"))
	if err != nil || out.Body.NUID != attacker {
		t.Fatalf("a new user creates their own row: %v", err)
	}
	me := middleware.Actor{NUID: attacker, Roles: []models.UserRole{models.UserRoleApplicant}}
	_, err = s.upsert(session(attackerEmail, &me), profile(admin, attackerEmail, "x"))
	testutil.WantStatus(t, err, http.StatusForbidden)

	out, err = s.upsert(session(attackerEmail, &me), profile(attacker, attackerEmail, "Renamed"))
	if err != nil || out.Body.FullName != "Renamed" || emailOf(attacker) != attackerEmail {
		t.Fatalf("a user updates only their own profile, not their email: %v", err)
	}

	_, err = s.get(testutil.WithActor(me), &ApplicantNUIDInput{NUID: admin})
	if err == nil {
		t.Fatal("an applicant can't read someone else's profile")
	}
	if _, err := s.get(testutil.WithActor(me), &ApplicantNUIDInput{NUID: attacker}); err != nil {
		t.Fatalf("you can read your own profile: %v", err)
	}
	if _, err := s.get(context.Background(), &ApplicantNUIDInput{NUID: admin}); err == nil {
		t.Fatal("profiles aren't public")
	}
}

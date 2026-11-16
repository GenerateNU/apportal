package middleware

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestOnSuccessRunsOnlyWhenTheRequestSucceeds(t *testing.T) {
	ran := 0
	app := fiber.New()
	app.Use(ReadIntent())
	app.Get("/:status", func(c fiber.Ctx) error {
		if err := OnSuccess(c.Context(), func() error { ran++; return nil }); err != nil {
			return err
		}
		if c.Params("status") == "fail" {
			return c.SendStatus(fiber.StatusConflict)
		}
		return c.SendStatus(fiber.StatusOK)
	})
	for _, tc := range []struct {
		path string
		want int
	}{{"/fail", 0}, {"/ok", 1}, {"/fail", 1}} {
		res, err := app.Test(httptest.NewRequest("GET", tc.path, nil))
		if err != nil {
			t.Fatal(err)
		}
		_ = res.Body.Close()
		if ran != tc.want {
			t.Fatalf("%s: ran %d times, want %d", tc.path, ran, tc.want)
		}
	}

	now := 0
	if err := OnSuccess(context.Background(), func() error { now++; return nil }); err != nil || now != 1 {
		t.Fatal("outside a request the hook runs right away")
	}
}

func TestReadIntent(t *testing.T) {
	var got Intent
	app := fiber.New()
	app.Use(ReadIntent())
	app.Post("/", func(c fiber.Ctx) error {
		got = IntentFrom(c.Context())
		return c.SendStatus(fiber.StatusNoContent)
	})
	res, err := app.Test(httptest.NewRequest("POST", "/?confirm_override=true&dry_run=true", nil))
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if !got.Confirm || !got.DryRun {
		t.Fatalf("intent %+v", got)
	}
}

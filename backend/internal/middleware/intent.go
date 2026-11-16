package middleware

import (
	"context"
	"log/slog"

	"github.com/gofiber/fiber/v3"
)

type Intent struct {
	Confirm bool
	DryRun  bool
}

// DryRunQuery declares the dry_run query ReadIntent reads, for inputs whose operation can preview instead of write.
type DryRunQuery struct {
	DryRun bool `query:"dry_run" doc:"Return the preview without changing anything"`
}

type intentKey struct{}

func WithIntent(ctx context.Context, in Intent) context.Context {
	return context.WithValue(ctx, intentKey{}, in)
}

func IntentFrom(ctx context.Context) Intent {
	in, _ := ctx.Value(intentKey{}).(Intent)
	return in
}

type onSuccessKey struct{}

type onSuccess struct{ fns []func() error }

// OnSuccess runs fn once the request has succeeded, or right away outside a request (tests, background work).
func OnSuccess(ctx context.Context, fn func() error) error {
	if hooks, ok := ctx.Value(onSuccessKey{}).(*onSuccess); ok {
		hooks.fns = append(hooks.fns, fn)
		return nil
	}
	return fn()
}

func ReadIntent() fiber.Handler {
	return func(c fiber.Ctx) error {
		in := Intent{Confirm: c.Query("confirm_override") == "true", DryRun: c.Query("dry_run") == "true"}
		hooks := &onSuccess{}
		ctx := context.WithValue(c.Context(), onSuccessKey{}, hooks)
		if in != (Intent{}) {
			ctx = WithIntent(ctx, in)
		}
		c.SetContext(ctx)
		err := c.Next()
		if err != nil || c.Response().StatusCode() >= 400 {
			return err
		}
		for _, fn := range hooks.fns {
			if ferr := fn(); ferr != nil {
				slog.ErrorContext(ctx, "after-success hook failed", "error", ferr)
			}
		}
		return nil
	}
}

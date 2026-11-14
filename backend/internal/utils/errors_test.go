package utils

import (
	"errors"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
)

func TestStoreErr(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want int
	}{
		{"not found", ErrNotFound, http.StatusNotFound},
		{"conflict", ErrConflict, http.StatusConflict},
		{"other", errExample("boom"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := StoreErr(tc.err)
			var se huma.StatusError
			if !errors.As(got, &se) {
				t.Fatalf("storeErr did not return a huma.StatusError: %T", got)
			}
			if se.GetStatus() != tc.want {
				t.Fatalf("status = %d, want %d", se.GetStatus(), tc.want)
			}
		})
	}
}

type errExample string

func (e errExample) Error() string { return string(e) }

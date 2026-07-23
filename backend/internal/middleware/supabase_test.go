package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSupabaseVerifierValidToken(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer good-token" {
			t.Fatalf("unexpected Authorization header: %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("apikey") != "anon-key" {
			t.Fatalf("unexpected apikey header: %s", r.Header.Get("apikey"))
		}
		_, _ = w.Write([]byte(`{"email":"person@example.com"}`))
	}))
	defer server.Close()

	v := NewSupabaseVerifier(server.URL, "anon-key")

	email, err := v.Verify(t.Context(), "good-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if email != "person@example.com" {
		t.Fatalf("email = %q, want person@example.com", email)
	}

	// A second call within the cache TTL should not hit the server again.
	if _, err := v.Verify(t.Context(), "good-token"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 (second lookup should be cached)", calls)
	}
}

func TestSupabaseVerifierInvalidToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	v := NewSupabaseVerifier(server.URL, "anon-key")

	if _, err := v.Verify(t.Context(), "bad-token"); err == nil {
		t.Fatal("expected an error for an invalid token")
	}
}

func TestSupabaseVerifierEmptyToken(t *testing.T) {
	v := NewSupabaseVerifier("http://unused.invalid", "anon-key")
	if _, err := v.Verify(t.Context(), ""); err == nil {
		t.Fatal("expected an error for an empty token")
	}
}

func TestBearerToken(t *testing.T) {
	cases := []struct {
		header string
		want   string
	}{
		{"Bearer abc123", "abc123"},
		{"", ""},
		{"abc123", ""},
		{"Basic abc123", ""},
	}
	for _, tc := range cases {
		if got := bearerToken(tc.header); got != tc.want {
			t.Errorf("bearerToken(%q) = %q, want %q", tc.header, got, tc.want)
		}
	}
}

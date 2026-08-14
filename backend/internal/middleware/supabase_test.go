package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
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

// A page firing several requests at once (e.g. the chief review queue) sends
// several concurrent Verify calls for the same bearer token before any of
// them has cached a result. Without in-flight de-duplication, each one would
// independently pay for a full Supabase round trip.
func TestSupabaseVerifierDeduplicatesConcurrentCalls(t *testing.T) {
	var calls int
	var mu sync.Mutex
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		calls++
		mu.Unlock()
		<-release
		_, _ = w.Write([]byte(`{"email":"person@example.com"}`))
	}))
	defer server.Close()

	v := NewSupabaseVerifier(server.URL, "anon-key")

	const n = 5
	var wg sync.WaitGroup
	errs := make([]error, n)
	emails := make([]string, n)
	for i := range n {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			emails[i], errs[i] = v.Verify(t.Context(), "good-token")
		}(i)
	}

	// Give every goroutine a chance to reach the server before any response
	// is released, so they're genuinely concurrent rather than serialized.
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()

	for i := range n {
		if errs[i] != nil {
			t.Fatalf("call %d: unexpected error: %v", i, errs[i])
		}
		if emails[i] != "person@example.com" {
			t.Fatalf("call %d: email = %q, want person@example.com", i, emails[i])
		}
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 (concurrent calls should be deduplicated)", calls)
	}
}

// The leader of a singleflight group is whichever caller happens to arrive
// first — e.g. one of several concurrent frontend requests sharing a bearer
// token. If that specific caller's own request is cancelled (a browser
// aborting a fetch, a page navigating away), the shared Supabase verification
// it's leading must keep running for the other, still-alive callers instead
// of failing all of them.
func TestSupabaseVerifierSurvivesLeaderCancellation(t *testing.T) {
	var calls int
	var mu sync.Mutex
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		calls++
		mu.Unlock()
		<-release
		_, _ = w.Write([]byte(`{"email":"person@example.com"}`))
	}))
	defer server.Close()

	v := NewSupabaseVerifier(server.URL, "anon-key")

	leaderCtx, cancelLeader := context.WithCancel(context.Background())

	const n = 5
	var wg sync.WaitGroup
	errs := make([]error, n)
	emails := make([]string, n)

	// Start the soon-to-be-cancelled leader first, then give it a moment to
	// actually become the singleflight leader before the rest join in.
	wg.Add(1)
	go func() {
		defer wg.Done()
		emails[0], errs[0] = v.Verify(leaderCtx, "good-token")
	}()
	time.Sleep(20 * time.Millisecond)

	for i := 1; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			emails[i], errs[i] = v.Verify(t.Context(), "good-token")
		}(i)
	}

	// Give the followers a chance to join the in-flight group, then cancel
	// the leader's own request context before the server ever responds.
	time.Sleep(20 * time.Millisecond)
	cancelLeader()
	time.Sleep(20 * time.Millisecond)
	close(release)
	wg.Wait()

	for i := 1; i < n; i++ {
		if errs[i] != nil {
			t.Fatalf("call %d: unexpected error after leader cancellation: %v", i, errs[i])
		}
		if emails[i] != "person@example.com" {
			t.Fatalf("call %d: email = %q, want person@example.com", i, emails[i])
		}
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 (leader cancellation shouldn't trigger a retry)", calls)
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

package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"
)

// verifyCacheTTL bounds how long a verified token is trusted without
// re-checking it against Supabase — long enough that a page firing several
// requests in quick succession only verifies its token once, short enough
// that a revoked session stops working promptly.
const verifyCacheTTL = 60 * time.Second

var errInvalidToken = errors.New("invalid or expired token")

// SupabaseVerifier confirms a bearer token is a live Supabase session by
// asking Supabase itself (GET /auth/v1/user) rather than verifying the JWT's
// signature locally.
type SupabaseVerifier struct {
	baseURL string
	anonKey string
	http    *http.Client

	mu    sync.Mutex
	cache map[string]cachedIdentity
}

type cachedIdentity struct {
	email     string
	expiresAt time.Time
}

// NewSupabaseVerifier builds a verifier for the given Supabase project.
// anonKey is the project's anon/publishable API key, required by Supabase's
// REST API alongside the caller's own bearer token.
func NewSupabaseVerifier(baseURL, anonKey string) *SupabaseVerifier {
	return &SupabaseVerifier{
		baseURL: strings.TrimRight(baseURL, "/"),
		anonKey: anonKey,
		http:    &http.Client{Timeout: 5 * time.Second},
		cache:   make(map[string]cachedIdentity),
	}
}

// Verify returns the email a live Supabase session belongs to, or
// errInvalidToken if the token is missing, invalid, or expired.
func (v *SupabaseVerifier) Verify(ctx context.Context, token string) (string, error) {
	if token == "" {
		return "", errInvalidToken
	}

	if email, ok := v.cached(token); ok {
		return email, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.baseURL+"/auth/v1/user", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", v.anonKey)

	resp, err := v.http.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", errInvalidToken
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.Email == "" {
		return "", errInvalidToken
	}

	v.store(token, body.Email)
	return body.Email, nil
}

func (v *SupabaseVerifier) cached(token string) (string, bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	entry, ok := v.cache[token]
	if !ok || time.Now().After(entry.expiresAt) {
		delete(v.cache, token)
		return "", false
	}
	return entry.email, true
}

func (v *SupabaseVerifier) store(token, email string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.cache[token] = cachedIdentity{email: email, expiresAt: time.Now().Add(verifyCacheTTL)}
}

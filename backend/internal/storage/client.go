// Package storage talks to Supabase Storage's REST API directly (no SDK
// exists for it, matching how internal/middleware/supabase.go verifies auth
// tokens with plain net/http) to mint signed upload/download URLs for
// applicant file uploads. The backend never proxies file bytes itself — it
// only hands out short-lived signed URLs that the frontend uploads to or
// downloads from directly.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Bucket is the single private bucket used for all application file
// uploads. PDF-only and the size cap are enforced by Storage itself (set at
// bucket-creation time) rather than re-implemented here.
const Bucket = "application-uploads"

const (
	maxFileSize      = "10MB"
	allowedMimeType  = "application/pdf"
	defaultURLExpiry = 10 * time.Minute
)

type Client struct {
	baseURL        string
	serviceRoleKey string
	http           *http.Client
}

// NewClient builds a Storage client for the given Supabase project.
// serviceRoleKey is required — signed upload/download URLs can only be
// minted with elevated (service role) privileges, not the anon key.
func NewClient(baseURL, serviceRoleKey string) *Client {
	return &Client{
		baseURL:        strings.TrimRight(baseURL, "/"),
		serviceRoleKey: serviceRoleKey,
		http:           &http.Client{Timeout: 10 * time.Second},
	}
}

// EnsureBucket creates the application-uploads bucket if it doesn't already
// exist. Safe to call on every server startup.
func (c *Client) EnsureBucket(ctx context.Context) error {
	body, err := json.Marshal(map[string]any{
		"id":                 Bucket,
		"name":               Bucket,
		"public":             false,
		"file_size_limit":    maxFileSize,
		"allowed_mime_types": []string{allowedMimeType},
	})
	if err != nil {
		return err
	}

	resp, err := c.do(ctx, http.MethodPost, "/storage/v1/bucket", body)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		return nil
	}

	respBody, _ := io.ReadAll(resp.Body)
	// Supabase returns 400/409 with a message mentioning the bucket already
	// existing — tolerate that so repeated startups aren't an error.
	if strings.Contains(strings.ToLower(string(respBody)), "already exists") {
		return nil
	}
	return fmt.Errorf("ensure bucket: unexpected status %d: %s", resp.StatusCode, respBody)
}

// CreateUploadURL mints a signed URL the caller can PUT a file's bytes to
// directly, authorized for this one object path only.
func (c *Client) CreateUploadURL(ctx context.Context, path string) (string, error) {
	resp, err := c.do(ctx, http.MethodPost, "/storage/v1/object/upload/sign/"+Bucket+"/"+path, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("create upload url: unexpected status %d: %s", resp.StatusCode, respBody)
	}

	var out struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return c.baseURL + "/storage/v1" + out.URL, nil
}

// CreateSignedURL mints a short-lived signed URL for reading an existing
// object at path.
func (c *Client) CreateSignedURL(ctx context.Context, path string) (string, error) {
	body, err := json.Marshal(map[string]any{
		"expiresIn": int(defaultURLExpiry.Seconds()),
	})
	if err != nil {
		return "", err
	}

	resp, err := c.do(ctx, http.MethodPost, "/storage/v1/object/sign/"+Bucket+"/"+path, body)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("create signed url: unexpected status %d: %s", resp.StatusCode, respBody)
	}

	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return c.baseURL + "/storage/v1" + out.SignedURL, nil
}

func (c *Client) do(ctx context.Context, method, path string, body []byte) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	req.Header.Set("apikey", c.serviceRoleKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.http.Do(req)
}

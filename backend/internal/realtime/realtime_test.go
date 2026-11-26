package realtime

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendPostsBroadcast(t *testing.T) {
	var got struct {
		Messages []message `json:"messages"`
	}
	var auth, apikey, path string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth, apikey = r.URL.Path, r.Header.Get("Authorization"), r.Header.Get("apikey")
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	b := NewBroadcaster(srv.URL+"/", "service-key")
	if err := b.send("draft:c1", "changed", map[string]string{"draft_id": "d1"}); err != nil {
		t.Fatalf("send: %v", err)
	}
	if path != "/realtime/v1/api/broadcast" {
		t.Errorf("path = %q", path)
	}
	if auth != "Bearer service-key" || apikey != "service-key" {
		t.Errorf("auth = %q, apikey = %q", auth, apikey)
	}
	if len(got.Messages) != 1 || got.Messages[0].Topic != "draft:c1" || got.Messages[0].Event != "changed" || got.Messages[0].Private {
		t.Errorf("messages = %+v", got.Messages)
	}
}

func TestSendReportsFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()
	if err := NewBroadcaster(srv.URL, "k").send("t", "e", nil); err == nil {
		t.Error("expected an error for a 401")
	}
}

func TestUnconfiguredIsNoop(t *testing.T) {
	b := NewBroadcaster("", "")
	if b != nil {
		t.Fatal("expected nil broadcaster without config")
	}
	b.Publish("t", "e", nil)
}

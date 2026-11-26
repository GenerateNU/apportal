package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const sendTimeout = 3 * time.Second

type Broadcaster struct {
	url            string
	serviceRoleKey string
	http           *http.Client
}

func NewBroadcaster(baseURL, serviceRoleKey string) *Broadcaster {
	if baseURL == "" || serviceRoleKey == "" {
		return nil
	}
	return &Broadcaster{
		url:            strings.TrimRight(baseURL, "/") + "/realtime/v1/api/broadcast",
		serviceRoleKey: serviceRoleKey,
		http:           &http.Client{Timeout: sendTimeout},
	}
}

type message struct {
	Topic   string `json:"topic"`
	Event   string `json:"event"`
	Payload any    `json:"payload"`
	Private bool   `json:"private"`
}

func (b *Broadcaster) Publish(topic, event string, payload any) {
	if b == nil {
		return
	}
	go func() {
		if err := b.send(topic, event, payload); err != nil {
			slog.Warn("realtime broadcast failed", "topic", topic, "event", event, "error", err)
		}
	}()
}

func (b *Broadcaster) send(topic, event string, payload any) error {
	body, err := json.Marshal(map[string][]message{
		"messages": {{Topic: topic, Event: event, Payload: payload}},
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), sendTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", b.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+b.serviceRoleKey)
	resp, err := b.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

package utils

import (
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

type Cursor struct {
	At   *time.Time `json:"t,omitempty"`
	Text string     `json:"s,omitempty"`
	ID   string     `json:"id"`
}

func (c Cursor) Encode() string {
	raw, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func ParseCursor(raw string) (*Cursor, error) {
	if raw == "" {
		return nil, nil
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	var c Cursor
	if err == nil {
		err = json.Unmarshal(data, &c)
	}
	if err != nil || c.ID == "" {
		return nil, huma.Error422UnprocessableEntity("cursor is malformed")
	}
	return &c, nil
}

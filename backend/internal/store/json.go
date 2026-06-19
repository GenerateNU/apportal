package store

import "encoding/json"

// jsonArg converts a JSONB payload into a driver argument. An empty/absent
// payload becomes NULL; otherwise it is passed as a string. pgx then sends it
// with an unknown OID so Postgres parses it as the column's jsonb type —
// passing []byte instead would be encoded as bytea and rejected by jsonb.
func jsonArg(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return string(raw)
}

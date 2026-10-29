package models

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"gorm.io/gorm/schema"
)

// Fields tagged `gorm:"serializer:jsonb"` pass JSONB through untouched. Writes
// go as text, since pgx would send a []byte as bytea, which jsonb rejects.
func init() {
	schema.RegisterSerializer("jsonb", jsonbSerializer{})
}

type jsonbSerializer struct{}

func (jsonbSerializer) Scan(ctx context.Context, field *schema.Field, dst reflect.Value, dbValue any) error {
	var raw json.RawMessage
	switch v := dbValue.(type) {
	case nil:
	case string:
		raw = json.RawMessage(v)
	case []byte:
		raw = append(json.RawMessage(nil), v...)
	default:
		return fmt.Errorf("jsonb: cannot scan %T", dbValue)
	}
	field.ReflectValueOf(ctx, dst).Set(reflect.ValueOf(raw))
	return nil
}

func (jsonbSerializer) Value(ctx context.Context, field *schema.Field, dst reflect.Value, fieldValue any) (any, error) {
	raw, _ := fieldValue.(json.RawMessage)
	return JSONValue(raw), nil
}

// JSONValue is the driver value for a JSONB payload; empty becomes NULL.
func JSONValue(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return string(raw)
}

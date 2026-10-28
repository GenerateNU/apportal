package models

import (
	"context"
	"fmt"
	"reflect"

	"github.com/jackc/pgx/v5/pgtype"
	"gorm.io/gorm/schema"
)

// GORM can't scan a Postgres array into a slice on its own; fields tagged
// `gorm:"serializer:pgarray"` go through this instead. Select the column as
// text[] (e.g. roles::text[]) so enum arrays decode too.
func init() {
	schema.RegisterSerializer("pgarray", pgArraySerializer{})
}

var pgTypes = pgtype.NewMap()

type pgArraySerializer struct{}

func (pgArraySerializer) Scan(ctx context.Context, field *schema.Field, dst reflect.Value, dbValue any) error {
	value := reflect.New(field.FieldType).Elem()
	if dbValue != nil {
		var raw string
		switch v := dbValue.(type) {
		case string:
			raw = v
		case []byte:
			raw = string(v)
		default:
			return fmt.Errorf("pgarray: cannot scan %T", dbValue)
		}
		var items []string
		if err := pgTypes.SQLScanner(&items).Scan(raw); err != nil {
			return err
		}
		value = reflect.MakeSlice(field.FieldType, len(items), len(items))
		for i, item := range items {
			value.Index(i).SetString(item)
		}
	}
	field.ReflectValueOf(ctx, dst).Set(value)
	return nil
}

func (pgArraySerializer) Value(ctx context.Context, field *schema.Field, dst reflect.Value, fieldValue any) (any, error) {
	return ArrayLiteral(reflect.ValueOf(fieldValue))
}

// ArrayLiteral renders a string-kinded slice as a Postgres array literal. pgx
// has no codec for enum arrays, but Postgres casts the text to the column type.
// A nil slice is NULL.
func ArrayLiteral(slice reflect.Value) (any, error) {
	if slice.Kind() != reflect.Slice || slice.IsNil() {
		return nil, nil
	}
	items := make([]string, slice.Len())
	for i := range items {
		items[i] = slice.Index(i).String()
	}
	buf, err := pgTypes.Encode(pgtype.TextArrayOID, pgtype.TextFormatCode, items, nil)
	return string(buf), err
}

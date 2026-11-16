package utils

// SetIf adds col to a partial-update map only when the caller supplied a value,
// so omitted fields keep their stored value.
func SetIf[T any](updates map[string]any, col string, v *T) {
	if v != nil {
		updates[col] = *v
	}
}

func Deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}

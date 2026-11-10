package utils

import "strings"

// likeEscaper neutralizes LIKE's own metacharacters so a user searching for
// "100%" or "snake_case" gets a literal match instead of a wildcard one.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// EscapeLike prepares user input for a LIKE/ILIKE pattern. Callers must pair it
// with `ESCAPE '\'` so the backslashes it inserts are read as escapes.
func EscapeLike(s string) string { return likeEscaper.Replace(s) }

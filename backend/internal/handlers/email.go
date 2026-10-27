package handlers

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

const northeasternEmailDomain = "@northeastern.edu"

func requireNortheasternEmail(email string) error {
	if !strings.HasSuffix(strings.ToLower(strings.TrimSpace(email)), northeasternEmailDomain) {
		return huma.Error422UnprocessableEntity("email must be a " + northeasternEmailDomain + " address")
	}
	return nil
}

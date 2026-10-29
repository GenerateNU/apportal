package utils

import "testing"

func TestRequireNortheasternEmail(t *testing.T) {
	cases := []struct {
		email   string
		wantErr bool
	}{
		{"descoteaux.a@northeastern.edu", false},
		{"Descoteaux.A@NORTHEASTERN.EDU", false},
		{"person@gmail.com", true},
		{"person@northeastern.edu.evil.com", true},
		{"person@notnortheastern.edu", true},
		{"", true},
	}
	for _, tc := range cases {
		t.Run(tc.email, func(t *testing.T) {
			if err := RequireNortheasternEmail(tc.email); (err != nil) != tc.wantErr {
				t.Fatalf("RequireNortheasternEmail(%q) err = %v, wantErr %v", tc.email, err, tc.wantErr)
			}
		})
	}
}

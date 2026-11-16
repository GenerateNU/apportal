package staffing

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/GenerateNU/apportal/backend/internal/testutil"
)

// Admins review chief cycles, which have no staff, so they make up its pool.
func TestPoolAddsAdminsOnChiefCycles(t *testing.T) {
	db := testutil.TestDB(t)
	exec := func(sql string, args ...any) {
		t.Helper()
		if err := db.Exec(sql, args...).Error; err != nil {
			t.Fatal(err)
		}
	}
	admin, chief := "t"+uuid.NewString()[:12], "t"+uuid.NewString()[:12]
	exec("INSERT INTO users (nuid, email, full_name, roles) VALUES (?, ?, 'A', '{admin}'), (?, ?, 'C', '{applicant}')",
		admin, admin+"@test.example", chief, chief+"@test.example")
	branch, chiefCycle, memberCycle := uuid.NewString(), uuid.NewString(), uuid.NewString()
	exec("INSERT INTO branches (id, name) VALUES (?, ?)", branch, "test-"+branch)
	exec("INSERT INTO cycles (id, branch_id, name, status, application_type) VALUES (?, ?, 'C', 'open', 'chief'), (?, ?, 'M', 'open', 'member')",
		chiefCycle, branch, memberCycle, branch)
	exec("INSERT INTO cycle_staff (cycle_id, user_nuid, role) VALUES (?, ?, 'chief')", memberCycle, chief)

	cases := []struct {
		name    string
		cycle   string
		in, out string
	}{
		{"chief cycle: admins", chiefCycle, admin, chief},
		{"member cycle: its staff only", memberCycle, chief, admin},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			o, err := LoadOpenings(db, tc.cycle)
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Contains(o.Staff, tc.in) || slices.Contains(o.Staff, tc.out) {
				t.Errorf("pool = %v, want %s in and %s out", o.Staff, tc.in, tc.out)
			}
			missing, err := NotStaff(db, tc.cycle, []string{tc.in, tc.out})
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(missing, []string{tc.out}) {
				t.Errorf("NotStaff = %v, want [%s]", missing, tc.out)
			}
		})
	}
}

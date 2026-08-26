package store

import "testing"

func TestSnakePosition(t *testing.T) {
	// Three teams: round 1 runs 0,1,2 and round 2 comes back 2,1,0 — so the
	// team in the last seat picks 3 and 4 back to back.
	want := []int{0, 1, 2, 2, 1, 0, 0, 1, 2}
	for i, w := range want {
		if got := SnakePosition(i+1, 3); got != w {
			t.Errorf("pick %d: got seat %d, want %d", i+1, got, w)
		}
	}
}

func TestSnakePositionSingleTeam(t *testing.T) {
	for pick := 1; pick <= 4; pick++ {
		if got := SnakePosition(pick, 1); got != 0 {
			t.Errorf("pick %d: got seat %d, want 0", pick, got)
		}
	}
}

func TestSnakePositionGuards(t *testing.T) {
	if got := SnakePosition(1, 0); got != 0 {
		t.Errorf("no teams: got %d, want 0", got)
	}
	if got := SnakePosition(0, 3); got != 0 {
		t.Errorf("no pick: got %d, want 0", got)
	}
}

func TestNextOpenSlot(t *testing.T) {
	cases := []struct {
		name  string
		taken []int
		total int
		want  int
	}{
		{"empty board", nil, 6, 1},
		{"in order", []int{1, 2, 3}, 6, 4},
		// The reason slots are keyed rather than appended: undoing pick 2 puts
		// that slot back on the clock, not the end of the board.
		{"hole from an undo", []int{1, 3, 4}, 6, 2},
		{"full", []int{1, 2, 3, 4, 5, 6}, 6, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nextOpenSlot(tc.taken, tc.total); got != tc.want {
				t.Errorf("got %d, want %d", got, tc.want)
			}
		})
	}
}

package interviewplan

import (
	"slices"
	"strings"
)

type Unit struct {
	ID      string
	Members []string
	Slot    string
}

type Applicant struct {
	ID      string
	Slots   []string
	Need    int
	Blocked map[string]bool
}

type Opening struct {
	RoleID     string
	Units      []Unit
	Applicants []Applicant
}

type Pick struct {
	ApplicationID string
	Unit          Unit
}

type Result struct {
	Picks       []Pick
	Short       []string
	NoSlotMatch []string
	Loads       map[string]int
}

type state struct {
	opening *Opening
	app     Applicant
	blocked map[string]bool
	got     int
}

func Plan(openings []Opening, loads map[string]int, matchSlots bool) Result {
	res := Result{Picks: []Pick{}, Short: []string{}, NoSlotMatch: []string{}, Loads: map[string]int{}}
	for k, v := range loads {
		res.Loads[k] = v
	}
	order := make([]*Opening, len(openings))
	for i := range openings {
		o := openings[i]
		o.Units = slices.Clone(o.Units)
		slices.SortFunc(o.Units, func(a, b Unit) int { return strings.Compare(a.ID, b.ID) })
		o.Applicants = slices.Clone(o.Applicants)
		slices.SortFunc(o.Applicants, func(a, b Applicant) int { return strings.Compare(a.ID, b.ID) })
		order[i] = &o
	}
	slices.SortStableFunc(order, func(a, b *Opening) int {
		if d := len(a.Units) - len(b.Units); d != 0 {
			return d
		}
		return strings.Compare(a.RoleID, b.RoleID)
	})

	var queues [][]*state
	rounds, width := 0, 0
	for _, o := range order {
		q := make([]*state, len(o.Applicants))
		for i, a := range o.Applicants {
			b := make(map[string]bool, len(a.Blocked))
			for k, v := range a.Blocked {
				b[k] = v
			}
			q[i] = &state{opening: o, app: a, blocked: b}
			rounds = max(rounds, a.Need)
		}
		width = max(width, len(q))
		queues = append(queues, q)
	}
	noSlot := map[string]bool{}
	for r := 0; r < rounds; r++ {
		for i := 0; i < width; i++ {
			for _, q := range queues {
				if i >= len(q) || q[i].got >= q[i].app.Need {
					continue
				}
				if u, ok := pick(q[i], res.Loads, matchSlots, noSlot); ok {
					res.Picks = append(res.Picks, Pick{ApplicationID: q[i].app.ID, Unit: u})
				}
			}
		}
	}
	for _, q := range queues {
		for _, s := range q {
			if s.got < s.app.Need {
				res.Short = append(res.Short, s.app.ID)
			}
			if noSlot[s.app.ID] {
				res.NoSlotMatch = append(res.NoSlotMatch, s.app.ID)
			}
		}
	}
	slices.Sort(res.Short)
	slices.Sort(res.NoSlotMatch)
	return res
}

func pick(s *state, loads map[string]int, matchSlots bool, noSlot map[string]bool) (Unit, bool) {
	var free, onSlot []Unit
	for _, u := range s.opening.Units {
		if len(u.Members) == 0 || slices.ContainsFunc(u.Members, func(m string) bool { return s.blocked[m] }) {
			continue
		}
		free = append(free, u)
		if u.Slot != "" && slices.Contains(s.app.Slots, u.Slot) {
			onSlot = append(onSlot, u)
		}
	}
	if len(free) == 0 {
		return Unit{}, false
	}
	if matchSlots && len(s.app.Slots) > 0 {
		if len(onSlot) > 0 {
			free = onSlot
		} else {
			noSlot[s.app.ID] = true
		}
	}
	best, bestLoad := free[0], load(free[0], loads)
	for _, u := range free[1:] {
		if l := load(u, loads); l < bestLoad {
			best, bestLoad = u, l
		}
	}
	for _, m := range best.Members {
		loads[m]++
		s.blocked[m] = true
	}
	s.got++
	return best, true
}

func load(u Unit, loads map[string]int) int {
	n := 0
	for _, m := range u.Members {
		n = max(n, loads[m])
	}
	return n
}

func Panels(people []string, slotOf map[string]string, size int) [][]string {
	if size <= 0 {
		return nil
	}
	people = slices.Clone(people)
	slices.SortFunc(people, func(a, b string) int {
		if d := strings.Compare(slotOf[a], slotOf[b]); d != 0 {
			return d
		}
		return strings.Compare(a, b)
	})
	var out [][]string
	var rest []string
	for i := 0; i < len(people); {
		j := i
		for j < len(people) && slotOf[people[j]] == slotOf[people[i]] {
			j++
		}
		group := people[i:j]
		if slotOf[people[i]] == "" {
			rest = append(rest, group...)
		} else {
			for len(group) >= size {
				out = append(out, slices.Clone(group[:size]))
				group = group[size:]
			}
			rest = append(rest, group...)
		}
		i = j
	}
	for len(rest) > 0 {
		n := min(size, len(rest))
		out = append(out, slices.Clone(rest[:n]))
		rest = rest[n:]
	}
	return out
}

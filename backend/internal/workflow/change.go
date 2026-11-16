package workflow

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"

	"github.com/GenerateNU/apportal/backend/internal/middleware"
)

type PreviewItem struct {
	ID            string `json:"id,omitempty"`
	Kind          string `json:"kind"`
	ApplicationID string `json:"application_id,omitempty"`
	Applicant     string `json:"applicant,omitempty"`
	Person        string `json:"person,omitempty"`
	Detail        string `json:"detail,omitempty"`
}

type Preview struct {
	Decision  PermissionResult `json:"decision"`
	Summary   []string         `json:"summary"`
	Changes   []PreviewItem    `json:"changes"`
	Kept      []PreviewItem    `json:"kept"`
	Applied   bool             `json:"applied"`
	Unchanged bool             `json:"unchanged,omitempty" doc:"Nothing to do; the cycle is already in that state"`
	level     Level
	ops       []Operation
}

func (p *Preview) Require(op Operation) { p.ops = append(p.ops, op) }

func (p *Preview) Raise(l Level) { p.level = maxLevel(p.level, l) }

func (p *Preview) Say(line string) { p.Summary = append(p.Summary, line) }

func (p Preview) json() json.RawMessage {
	raw, _ := json.Marshal(p)
	return raw
}

// A Change's Preview must describe exactly what Apply will do, since the dry-run response is that preview.
type Change interface {
	Operation() Operation
	Preview(tx *gorm.DB, f *CycleState) (Preview, error)
	Apply(tx *gorm.DB, f *CycleState, p Preview) error
}

type change struct {
	op      Operation
	preview func(tx *gorm.DB, f *CycleState) (Preview, error)
	apply   func(tx *gorm.DB, f *CycleState, p Preview) error
}

func (c change) Operation() Operation { return c.op }

func (c change) Preview(tx *gorm.DB, f *CycleState) (Preview, error) {
	if c.preview == nil {
		return Preview{}, nil
	}
	return c.preview(tx, f)
}

func (c change) Apply(tx *gorm.DB, f *CycleState, p Preview) error { return c.apply(tx, f, p) }

var errDryRun = errors.New("dry run")

func execute(db *gorm.DB, cycleID string, c Change) (Preview, error) {
	var out Preview
	err := inTx(db, cycleID, func(tx *gorm.DB, f *CycleState) error {
		p, err := c.Preview(tx, f)
		if err != nil {
			return err
		}
		if op := c.Operation(); op.Op != "" {
			p.ops = append([]Operation{op}, p.ops...)
		}
		p.Summary, p.Changes, p.Kept = orEmpty(p.Summary), orEmptyItems(p.Changes), orEmptyItems(p.Kept)
		if p.Unchanged {
			p.Decision = PermissionResult{Allowed: true, Level: LevelNormal}
			out = p
			return nil
		}
		p.Decision = p.decide(f)
		out = p
		if len(p.ops) > 0 && p.ops[0].Caller.Intent.DryRun {
			return errDryRun
		}
		if err := p.enforce(tx, f); err != nil {
			return err
		}
		if err := c.Apply(tx, f, p); err != nil {
			return err
		}
		out.Applied = true
		return nil
	})
	if errors.Is(err, errDryRun) {
		return out, nil
	}
	return out, err
}

func (p *Preview) withLevel(op Operation) Operation {
	op.Level = maxLevel(op.Level, p.level)
	if op.Reason == "" && len(p.Summary) > 0 {
		op.Reason = p.Summary[0]
	}
	return op
}

func (p *Preview) decide(f *CycleState) PermissionResult {
	out := PermissionResult{Allowed: true, Level: LevelNormal}
	for _, op := range p.ops {
		d := f.CheckPermission(p.withLevel(op))
		if d.Level.rank() > out.Level.rank() {
			out.Level = d.Level
		}
		if out.Reason == "" && d.Reason != "" {
			out.Reason = d.Reason
		}
		out.Allowed = out.Allowed && d.Allowed
		out.NeedsConfirm = out.NeedsConfirm || d.NeedsConfirm
	}
	return out
}

// enforce refuses the first operation the caller may not do, and records every confirmed override.
func (p *Preview) enforce(tx *gorm.DB, f *CycleState) error {
	for _, op := range p.ops {
		op = p.withLevel(op)
		if err := f.EnforcePermission(op); err != nil {
			return err
		}
	}
	for _, op := range p.ops {
		op = p.withLevel(op)
		if d := f.CheckPermission(op); d.Level != LevelNormal {
			if err := recordOverride(tx, f.CycleID, op, d, p); err != nil {
				return err
			}
		}
	}
	return nil
}

// Authorize enforces each operation and records, in tx, the ones that went through as a confirmed override.
func Authorize(tx *gorm.DB, f *CycleState, ops ...Operation) error {
	if err := enforceAll(f, ops); err != nil {
		return err
	}
	return recordAll(tx, f, ops)
}

// authorizeOnSuccess is Authorize for checks ahead of a handler's own write: inside a transaction the overrides commit
// with it; otherwise they are recorded once the request succeeds, so a write that fails leaves no audit row.
func authorizeOnSuccess(ctx context.Context, db *gorm.DB, f *CycleState, ops ...Operation) error {
	if err := enforceAll(f, ops); err != nil {
		return err
	}
	if _, inTx := db.Statement.ConnPool.(gorm.TxCommitter); inTx {
		return recordAll(db, f, ops)
	}
	return middleware.OnSuccess(ctx, func() error { return recordAll(db, f, ops) })
}

func enforceAll(f *CycleState, ops []Operation) error {
	for _, op := range ops {
		if err := f.EnforcePermission(op); err != nil {
			return err
		}
	}
	return nil
}

func recordAll(tx *gorm.DB, f *CycleState, ops []Operation) error {
	seen := map[Operation]bool{}
	for _, op := range ops {
		d := f.CheckPermission(op)
		if d.Level == LevelNormal || seen[op] {
			continue
		}
		seen[op] = true
		if err := recordOverride(tx, f.CycleID, op, d, nil); err != nil {
			return err
		}
	}
	return nil
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func orEmptyItems(c []PreviewItem) []PreviewItem {
	if c == nil {
		return []PreviewItem{}
	}
	return c
}

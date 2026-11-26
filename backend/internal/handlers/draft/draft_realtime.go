package draft

import "context"

const ChangedEvent = "changed"

func Topic(cycleID string) string { return "draft:" + cycleID }

func (s *draftService) announce(cycleID, draftID, roleID string) {
	s.realtime.Publish(Topic(cycleID), ChangedEvent, map[string]string{
		"draft_id": draftID,
		"role_id":  roleID,
	})
}

func announceDraft[I, O any](
	s *draftService,
	draftID func(*I) string,
	handle func(context.Context, *I) (*O, error),
) func(context.Context, *I) (*O, error) {
	return func(ctx context.Context, in *I) (*O, error) {
		draft, lookupErr := s.draftDB.GetDraftByID(ctx, draftID(in))
		out, err := handle(ctx, in)
		if err == nil && lookupErr == nil {
			s.announce(draft.CycleID, draft.ID, draft.RoleID)
		}
		return out, err
	}
}

func (s *draftService) openAndAnnounce(ctx context.Context, in *OpenDraftInput) (*DraftOutput, error) {
	out, err := s.open(ctx, in)
	if err == nil {
		s.announce(out.Body.CycleID, out.Body.ID, out.Body.RoleID)
	}
	return out, err
}

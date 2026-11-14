package tag

import (
	"context"
	"slices"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/GenerateNU/apportal/backend/internal/handlers/application"
	"github.com/GenerateNU/apportal/backend/internal/utils"
)

// Palette is the set of tag colors; the frontend maps each to a style.
var Palette = []string{"gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"}

type tagService struct {
	tagDB         *TagDB
	applicationDB *application.ApplicationDB
}

func (s *tagService) list(ctx context.Context, in *utils.CycleScopedInput) (*TagsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	tags, err := s.tagDB.ListTags(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &TagsOutput{Body: tags}, nil
}

func (s *tagService) create(ctx context.Context, in *CreateTagInput) (*TagOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	name, err := cleanName(in.Body.Name)
	if err != nil {
		return nil, err
	}
	taken, err := s.tagDB.TagNameTaken(ctx, in.ID, name, "")
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if taken {
		return nil, huma.Error409Conflict("a tag with that name already exists")
	}
	existing, err := s.tagDB.ListTags(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	tag, err := s.tagDB.CreateTag(ctx, in.ID, name, Palette[len(existing)%len(Palette)])
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &TagOutput{Body: tag}, nil
}

func (s *tagService) update(ctx context.Context, in *UpdateTagInput) (*TagOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	if in.Body.Color != nil && !slices.Contains(Palette, *in.Body.Color) {
		return nil, huma.Error422UnprocessableEntity("color is not in the palette")
	}
	if in.Body.Name != nil {
		name, err := cleanName(*in.Body.Name)
		if err != nil {
			return nil, err
		}
		in.Body.Name = &name
		current, err := s.tagDB.GetTag(ctx, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		taken, err := s.tagDB.TagNameTaken(ctx, current.CycleID, name, in.ID)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if taken {
			return nil, huma.Error409Conflict("a tag with that name already exists")
		}
	}
	tag, err := s.tagDB.UpdateTag(ctx, in.ID, in.Body.Name, in.Body.Color)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	return &TagOutput{Body: tag}, nil
}

func (s *tagService) delete(ctx context.Context, in *utils.IDInput) (*struct{}, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	tag, err := s.tagDB.GetTag(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if err := s.tagDB.DeleteTag(ctx, tag); err != nil {
		return nil, utils.StoreErr(err)
	}
	return nil, nil
}

func (s *tagService) setApplicationTags(ctx context.Context, in *SetApplicationTagsInput) (*ApplicationTagsOutput, error) {
	if err := utils.RequireReviewer(ctx); err != nil {
		return nil, err
	}
	ids := in.Body.TagIDs
	if ids == nil {
		ids = []string{}
	}
	if len(ids) > MaxTagsPerApplication {
		return nil, huma.Error422UnprocessableEntity("an application can have at most 3 tags")
	}
	if len(slices.Compact(slices.Sorted(slices.Values(ids)))) != len(ids) {
		return nil, huma.Error422UnprocessableEntity("tag_ids contains duplicates")
	}
	app, err := s.applicationDB.GetApplication(ctx, in.ID)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	if len(ids) > 0 {
		n, err := s.tagDB.CountCycleTags(ctx, app.CycleID, ids)
		if err != nil {
			return nil, utils.StoreErr(err)
		}
		if n != len(ids) {
			return nil, huma.Error422UnprocessableEntity("every tag must belong to the application's cycle")
		}
	}
	saved, err := s.tagDB.SetApplicationTags(ctx, in.ID, ids)
	if err != nil {
		return nil, utils.StoreErr(err)
	}
	out := &ApplicationTagsOutput{}
	out.Body.TagIDs = saved
	return out, nil
}

func cleanName(raw string) (string, error) {
	name := strings.Join(strings.Fields(raw), " ")
	if name == "" {
		return "", huma.Error422UnprocessableEntity("name is required")
	}
	if len([]rune(name)) > maxNameLen {
		return "", huma.Error422UnprocessableEntity("name is too long")
	}
	return name, nil
}

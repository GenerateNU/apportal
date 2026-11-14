'use client'

import { TagSelect } from '@/components/ui/tag-select'
import {
  useCreateTag,
  useCycleTags,
  useDeleteTag,
  useSetApplicationTags,
  useUpdateTag,
} from '@/lib/queries/tags'

const MAX_TAGS = 3

// The tag picker for one application, wired to the cycle's catalog. `tagIds`
// comes from whatever the caller already loaded (the application or a list
// row), so the page needn't fetch the application again just for this.
export function CandidateTags({
  applicationId,
  cycleId,
  tagIds,
}: {
  applicationId: string
  cycleId: string
  tagIds: string[] | null | undefined
}) {
  const { data: tags = [] } = useCycleTags(cycleId)
  const createTag = useCreateTag(cycleId)
  const updateTag = useUpdateTag(cycleId)
  const deleteTag = useDeleteTag(cycleId)
  const setTags = useSetApplicationTags(applicationId)

  return (
    <TagSelect
      tags={tags}
      selectedIds={tagIds ?? []}
      max={MAX_TAGS}
      onChange={(ids) => setTags.mutate(ids)}
      onCreate={(name) => createTag.mutateAsync(name)}
      onRename={(id, name) => updateTag.mutateAsync({ id, name })}
      onRecolor={(id, color) => updateTag.mutateAsync({ id, color })}
      onDelete={(id) => deleteTag.mutateAsync(id)}
    />
  )
}

'use client'

import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PreferenceListComment } from '@/lib/api/types'

export function CommentThread({
  comments,
  currentUserNuid,
  onAdd,
  onEdit,
  isAdding,
  isEditing,
  placeholder,
}: {
  comments: PreferenceListComment[]
  currentUserNuid?: string
  onAdd: (body: string) => void
  onEdit: (commentId: string, body: string) => void
  isAdding: boolean
  isEditing: boolean
  placeholder: string
}) {
  const [newComment, setNewComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  function startEditing(comment: PreferenceListComment) {
    setEditingCommentId(comment.id)
    setEditingBody(comment.body)
  }

  function saveEdit() {
    const body = editingBody.trim()
    if (!editingCommentId || !body) return
    onEdit(editingCommentId, body)
    setEditingCommentId(null)
  }

  function postComment() {
    const body = newComment.trim()
    if (!body) return
    onAdd(body)
    setNewComment('')
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => {
        const editing = editingCommentId === c.id
        const edited = c.updated_at !== c.created_at
        const isOwn = c.author_nuid === currentUserNuid
        return (
          <div
            key={c.id}
            className="rounded-xl border border-gray-100 bg-white p-4"
          >
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={3}
                  autoFocus
                  aria-label="Edit comment"
                  className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={saveEdit}
                    disabled={isEditing || !editingBody.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingCommentId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-text-muted text-xs">
                    {c.author_name || c.author_nuid}
                  </p>
                  <p className="text-text-default mt-1 text-sm whitespace-pre-wrap">
                    {c.body}
                  </p>
                  <p className="text-text-faint mt-1.5 text-xs">
                    {new Date(c.created_at).toLocaleString()}
                    {edited && ' · edited'}
                  </p>
                </div>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => startEditing(c)}
                    className="text-text-faint hover:text-text-muted shrink-0"
                    aria-label="Edit comment"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="focus:border-brand-blue text-text-default placeholder:text-text-subtle w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none"
        />
        <div className="mt-3">
          <Button
            onClick={postComment}
            disabled={isAdding || !newComment.trim()}
          >
            {isAdding ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Posting…
              </>
            ) : (
              'Post comment'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

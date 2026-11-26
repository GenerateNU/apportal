'use client'

import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { PreferenceListComment } from '@/lib/api/types'

type ThreadComment = Pick<
  PreferenceListComment,
  'id' | 'body' | 'created_at' | 'updated_at' | 'author_nuid' | 'author_name'
>

export function CommentThread({
  comments,
  currentUserNuid,
  onAdd,
  onEdit,
  isAdding,
  isEditing,
  placeholder,
}: {
  comments: ThreadComment[]
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

  function startEditing(comment: ThreadComment) {
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
          <Card key={c.id} variant="flat">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={3}
                  autoFocus
                  aria-label="Edit comment"
                  className="focus:border-ink text-text-default placeholder:text-text-subtle w-full border border-gray-200 p-3 text-sm focus:outline-none"
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
                <div className="min-w-0">
                  <p className="text-text-muted text-xs">
                    {c.author_name || c.author_nuid}
                  </p>
                  <p className="text-text-default mt-1 text-sm wrap-anywhere whitespace-pre-wrap">
                    {c.body}
                  </p>
                  <p className="text-text-faint mt-1.5 flex items-center gap-2 text-xs">
                    {new Date(c.created_at).toLocaleString()}
                    {edited && <span className="italic">Edited</span>}
                  </p>
                </div>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => startEditing(c)}
                    className="text-text-faint hover:text-text-muted shrink-0 pointer-coarse:-m-2 pointer-coarse:p-2"
                    aria-label="Edit comment"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </Card>
        )
      })}

      <Card variant="flat">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="focus:border-ink text-text-default placeholder:text-text-subtle w-full border border-gray-200 p-3 text-sm focus:outline-none"
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
      </Card>
    </div>
  )
}

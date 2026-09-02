'use client'

import { Check, Copy, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RenderedDecision } from './render'
import { useCopy } from './useCopy'

// The finished message, exactly as it will be pasted into an email. Rendered
// from the same function the copy buttons read, so preview and clipboard can't
// disagree.
export function MessagePreview({
  rendered,
  email,
  copyKeyPrefix,
  overridden,
}: {
  rendered: RenderedDecision
  email: string
  copyKeyPrefix: string
  overridden?: boolean
}) {
  const { copy, copiedKey } = useCopy()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
          Message{overridden && ' (edited by hand)'}
        </h4>
        <div className="flex items-center gap-1.5">
          <CopyButton
            onClick={() =>
              copy(email, `${copyKeyPrefix}-email`, 'email address')
            }
            copied={copiedKey === `${copyKeyPrefix}-email`}
            icon={<Mail size={13} />}
            label="Email"
          />
          <CopyButton
            onClick={() =>
              copy(rendered.subject, `${copyKeyPrefix}-subject`, 'subject')
            }
            copied={copiedKey === `${copyKeyPrefix}-subject`}
            label="Subject"
          />
          <CopyButton
            onClick={() =>
              copy(rendered.body, `${copyKeyPrefix}-body`, 'message')
            }
            copied={copiedKey === `${copyKeyPrefix}-body`}
            label="Message"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <p className="text-text-muted border-b border-gray-200 px-3 py-2 text-xs">
          {rendered.subject}
        </p>
        <pre className="text-text-default max-h-[28rem] overflow-y-auto px-3 py-3 font-sans text-sm break-words whitespace-pre-wrap">
          {rendered.body}
        </pre>
      </div>
    </div>
  )
}

function CopyButton({
  onClick,
  copied,
  label,
  icon,
}: {
  onClick: () => void
  copied: boolean
  label: string
  icon?: React.ReactNode
}) {
  return (
    <Button size="xs" variant="outline" onClick={onClick}>
      {copied ? <Check size={13} /> : (icon ?? <Copy size={13} />)}
      {copied ? 'Copied' : label}
    </Button>
  )
}

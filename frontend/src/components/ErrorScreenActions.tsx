'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RetryButton({ retry }: { retry: () => void }) {
  return <Button onClick={retry}>Try again</Button>
}

export function BackButton() {
  const router = useRouter()
  return (
    <Button variant="outline" onClick={() => router.back()}>
      <ArrowLeft className="h-4 w-4" />
      Go back
    </Button>
  )
}

export function CopyReference({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(digest)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-text-subtle hover:text-ink mt-6 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
      title="Copy reference"
    >
      Reference {digest}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

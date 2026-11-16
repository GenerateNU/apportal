'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { type OverrideRequest, setOverrideAsker } from '@/lib/api/override'

export function OverrideConfirmProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [request, setRequest] = useState<OverrideRequest | null>(null)
  const resolve = useRef<((ok: boolean) => void) | null>(null)

  useEffect(() => {
    setOverrideAsker(
      (r) =>
        new Promise<boolean>((done) => {
          resolve.current?.(false)
          resolve.current = done
          setRequest(r)
        })
    )
    return () => setOverrideAsker(undefined)
  }, [])

  const answer = (ok: boolean) => {
    resolve.current?.(ok)
    resolve.current = null
    setRequest(null)
  }

  const destructive = request?.level === 'destructive'
  return (
    <>
      {children}
      <ConfirmDialog
        open={!!request}
        onOpenChange={(open) => !open && answer(false)}
        title={
          destructive ? 'This change is destructive' : 'This needs an override'
        }
        description={
          <>
            {request?.reason}
            {request?.reason && '. '}
            {destructive
              ? 'It can remove or hide work that has already started. It will be recorded.'
              : 'It goes past what the workflow normally allows. It will be recorded.'}
          </>
        }
        confirmLabel={destructive ? 'Do it anyway' : 'Override'}
        onConfirm={() => answer(true)}
      />
    </>
  )
}

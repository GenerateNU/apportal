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
        title={destructive ? 'Are you sure?' : 'This needs an override'}
        description={
          destructive ? (
            request?.reason ? (
              `${request.reason}.`
            ) : (
              'Do you want to continue?'
            )
          ) : (
            <>
              {request?.reason}
              {request?.reason && '. '}
              It goes past what the workflow normally allows. It will be
              recorded.
            </>
          )
        }
        confirmLabel={destructive ? 'Yes, continue' : 'Override'}
        onConfirm={() => answer(true)}
      />
    </>
  )
}

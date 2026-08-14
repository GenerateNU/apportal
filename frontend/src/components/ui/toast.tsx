'use client'

import * as React from 'react'
import { CheckCircle2, TriangleAlert, X } from 'lucide-react'

import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'error'

type Toast = {
  id: number
  message: string
  variant: ToastVariant
}

type ToastOptions = {
  variant?: ToastVariant
  // Milliseconds on screen. Long enough to read the message, and no longer —
  // a toast is a receipt for something the user just did, not a notification.
  duration?: number
}

const DEFAULT_DURATION_MS = 2500

// Beyond a few, the stack is noise and the oldest are already unread. Oldest
// are dropped rather than newest refused: the newest is the one the user just
// caused.
const MAX_VISIBLE = 3

const ToastContext = React.createContext<
  ((message: string, options?: ToastOptions) => void) | null
>(null)

// useToast returns the show function itself rather than an object, so callers
// can hold a stable reference in a dependency array.
export function useToast() {
  const toast = React.useContext(ToastContext)
  if (!toast) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return toast
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const nextId = React.useRef(0)

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback((message: string, options?: ToastOptions) => {
    const entry: Toast = {
      id: nextId.current++,
      message,
      variant: options?.variant ?? 'default',
    }
    setToasts((current) => [...current, entry].slice(-MAX_VISIBLE))
    return entry.id
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Announced politely, so a copy/save confirmation doesn't interrupt
          whatever a screen reader is reading. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((entry) => (
          <ToastItem
            key={entry.id}
            toast={entry}
            duration={DEFAULT_DURATION_MS}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2 | null> = {
  default: null,
  success: CheckCircle2,
  error: TriangleAlert,
}

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  default: '',
  success: 'text-green-600',
  error: 'text-red-600',
}

function ToastItem({
  toast,
  duration,
  onDismiss,
}: {
  toast: Toast
  duration: number
  onDismiss: (id: number) => void
}) {
  // Each toast owns its own timer, so the provider never has to track a map of
  // them — unmounting clears it.
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  const Icon = VARIANT_ICON[toast.variant]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex items-center gap-2 rounded-lg border border-gray-200 bg-white py-2 pr-2 pl-3 shadow-md duration-150">
      {Icon && (
        <Icon
          className={cn('h-4 w-4 shrink-0', VARIANT_ICON_COLOR[toast.variant])}
        />
      )}
      <span className="text-text-default text-sm">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-text-subtle hover:text-text-default rounded-md p-1 transition-colors hover:bg-gray-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

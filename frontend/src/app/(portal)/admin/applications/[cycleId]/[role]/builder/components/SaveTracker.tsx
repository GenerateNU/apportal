'use client'

import { createContext, useCallback, useContext, useReducer } from 'react'
import { useToast } from '@/components/ui/toast'
import { apiErrorDetail, OverrideDeclined } from '@/lib/api/client'
import { SaveIndicator } from '@/components/ui/save-indicator'
import {
  INITIAL_SAVE_STATE,
  saveStatus,
  saveReducer,
  type SaveState,
} from '../lib/save-status'

type MutateOptions<D> = {
  onSuccess?: (data: D) => void
  onError?: (error: unknown) => void
}
type Mutation<V, D> = {
  mutate: (vars: V, opts?: MutateOptions<D>) => void
}
type Save = <V, D>(
  mutation: Mutation<V, D>,
  vars: V,
  opts?: MutateOptions<D>
) => void

const SaveContext = createContext<{ state: SaveState; save: Save } | null>(null)

// Every builder edit goes through save(), so one label covers them all and
// no failure goes unexplained.
export function SaveTrackerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, dispatch] = useReducer(saveReducer, INITIAL_SAVE_STATE)
  const toast = useToast()
  const save = useCallback<Save>(
    (mutation, vars, opts) => {
      dispatch({ type: 'start' })
      mutation.mutate(vars, {
        onSuccess: (data) => {
          dispatch({ type: 'success' })
          opts?.onSuccess?.(data)
        },
        onError: (error) => {
          if (error instanceof OverrideDeclined) {
            dispatch({ type: 'success' })
            return
          }
          dispatch({ type: 'failure' })
          toast(`Couldn’t save: ${apiErrorDetail(error)}`, {
            variant: 'error',
            duration: 5000,
          })
          opts?.onError?.(error)
        },
      })
    },
    [toast]
  )
  return (
    <SaveContext.Provider value={{ state, save }}>
      {children}
    </SaveContext.Provider>
  )
}

export function useSave(): Save {
  const ctx = useContext(SaveContext)
  if (!ctx) throw new Error('useSave must be used inside a SaveTrackerProvider')
  return ctx.save
}

export function SaveStatusLabel() {
  const ctx = useContext(SaveContext)
  return <SaveIndicator status={ctx ? saveStatus(ctx.state) : 'idle'} />
}

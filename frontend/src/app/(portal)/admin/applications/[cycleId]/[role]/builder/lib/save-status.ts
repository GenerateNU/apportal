import type { SaveIndicatorStatus } from '@/components/ui/save-indicator'

export type SaveState = { pending: number; failed: boolean; saved: boolean }
export type SaveEvent = { type: 'start' | 'success' | 'failure' }

export const INITIAL_SAVE_STATE: SaveState = {
  pending: 0,
  failed: false,
  saved: false,
}

// The latest outcome wins: a later success clears an earlier failure.
export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'start':
      return { ...state, pending: state.pending + 1 }
    case 'success':
      return {
        pending: Math.max(0, state.pending - 1),
        failed: false,
        saved: true,
      }
    case 'failure':
      return { ...state, pending: Math.max(0, state.pending - 1), failed: true }
  }
}

export function saveStatus(state: SaveState): SaveIndicatorStatus {
  if (state.pending > 0) return 'saving'
  if (state.failed) return 'error'
  return state.saved ? 'saved' : 'idle'
}

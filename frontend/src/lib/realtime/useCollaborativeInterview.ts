import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { fromBase64, toBase64 } from 'lib0/buffer'
import * as Y from 'yjs'
import { createClient } from '@/lib/supabase/client'

export type InterviewFields = {
  recording_url: string
  notes_url: string
  rating: string
}

export type Peer = { nuid: string; name: string }

type Me = { nuid: string; name: string }

const LOCAL = Symbol('local')
const REMOTE = Symbol('remote')
const SYNC_WAIT_MS = 700
const FLUSH_MS = 40
const TYPING_HOLD_MS = 2000
const TYPING_PING_MS = 500

function seedClientId(text: string, fields: InterviewFields) {
  const input = JSON.stringify([text, fields])
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0 || 1
}

function seedUpdate(text: string, fields: InterviewFields) {
  const seed = new Y.Doc()
  seed.clientID = seedClientId(text, fields)
  seed.getText('writeup').insert(0, text)
  const map = seed.getMap<string>('fields')
  for (const [k, v] of Object.entries(fields)) if (v) map.set(k, v)
  const update = Y.encodeStateAsUpdate(seed)
  seed.destroy()
  return update
}

function readFields(map: Y.Map<string>): InterviewFields {
  return {
    recording_url: map.get('recording_url') ?? '',
    notes_url: map.get('notes_url') ?? '',
    rating: map.get('rating') ?? '',
  }
}

export function useCollaborativeInterview({
  room,
  initial,
  me,
  onRemoteSaved,
}: {
  room: string | null
  initial: { text: string; fields: InterviewFields } | null
  me: Me | null
  onRemoteSaved?: () => void
}) {
  const [text, setTextState] = useState('')
  const [fields, setFieldsState] = useState<InterviewFields>({
    recording_url: '',
    notes_url: '',
    rating: '',
  })
  const [peers, setPeers] = useState<Peer[]>([])
  const [ready, setReady] = useState(false)
  const [typingPeers, setTypingPeers] = useState<Peer[]>([])

  const docRef = useRef<Y.Doc | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingSelection = useRef<[number, number] | null>(null)
  const lockedRef = useRef(false)
  const lastLocalTypeAt = useRef(0)
  const lastPingAt = useRef(0)
  const initialRef = useRef(initial)
  const onRemoteSavedRef = useRef(onRemoteSaved)
  useEffect(() => {
    initialRef.current = initial
    onRemoteSavedRef.current = onRemoteSaved
  })

  const hasInitial = initial !== null
  const meNuid = me?.nuid
  const meName = me?.name

  useEffect(() => {
    if (!room || !hasInitial || !meNuid) return
    const doc = new Y.Doc()
    const ytext = doc.getText('writeup')
    const ymap = doc.getMap<string>('fields')
    docRef.current = doc

    const supabase = createClient()
    const channel = supabase.channel(`interview-writeup:${room}`, {
      config: { broadcast: { self: false }, presence: { key: meNuid } },
    })
    channelRef.current = channel

    let queued: Uint8Array[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      flushTimer = null
      if (!queued.length) return
      const merged = Y.mergeUpdates(queued)
      queued = []
      void channel.send({
        type: 'broadcast',
        event: 'update',
        payload: { u: toBase64(merged) },
      })
    }
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return
      queued.push(update)
      flushTimer ??= setTimeout(flush, FLUSH_MS)
    })

    ytext.observe(() => setTextState(ytext.toString()))
    ymap.observe(() => setFieldsState(readFields(ymap)))

    const applyRemote = (b64: string) => {
      const el = textareaRef.current
      let rel: [Y.RelativePosition, Y.RelativePosition] | null = null
      if (el && document.activeElement === el) {
        rel = [
          Y.createRelativePositionFromTypeIndex(ytext, el.selectionStart),
          Y.createRelativePositionFromTypeIndex(ytext, el.selectionEnd),
        ]
      }
      Y.applyUpdate(doc, fromBase64(b64), REMOTE)
      if (rel) {
        const a = Y.createAbsolutePositionFromRelativePosition(rel[0], doc)
        const b = Y.createAbsolutePositionFromRelativePosition(rel[1], doc)
        if (a && b) pendingSelection.current = [a.index, b.index]
      }
    }

    const typingAt = new Map<string, { name: string; at: number }>()
    const refreshTyping = () => {
      const now = Date.now()
      const iAmTyping = now - lastLocalTypeAt.current < TYPING_HOLD_MS
      const active: Peer[] = []
      for (const [nuid, t] of typingAt) {
        if (now - t.at < TYPING_HOLD_MS) active.push({ nuid, name: t.name })
        else typingAt.delete(nuid)
      }
      const blocking = iAmTyping ? [] : active
      lockedRef.current = blocking.length > 0
      setTypingPeers((prev) =>
        prev.length === blocking.length &&
        prev.every((p, i) => p.nuid === blocking[i].nuid)
          ? prev
          : blocking
      )
    }
    const typingTimer = setInterval(refreshTyping, 250)

    let gotReply = false
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.nuid || payload.nuid === meNuid) return
        typingAt.set(payload.nuid, {
          name: payload.name ?? payload.nuid,
          at: Date.now(),
        })
        refreshTyping()
      })
      .on('broadcast', { event: 'update' }, ({ payload }) =>
        applyRemote(payload.u)
      )
      .on('broadcast', { event: 'sync-request' }, ({ payload }) => {
        if (!payload?.sv) return
        const diff = Y.encodeStateAsUpdate(doc, fromBase64(payload.sv))
        void channel.send({
          type: 'broadcast',
          event: 'sync-reply',
          payload: { to: payload.from, u: toBase64(diff) },
        })
      })
      .on('broadcast', { event: 'sync-reply' }, ({ payload }) => {
        if (payload?.to !== meNuid) return
        gotReply = true
        applyRemote(payload.u)
      })
      .on('broadcast', { event: 'saved' }, () => onRemoteSavedRef.current?.())
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<Peer>()
        const seen = new Map<string, Peer>()
        for (const entries of Object.values(state)) {
          for (const p of entries) {
            if (p.nuid !== meNuid)
              seen.set(p.nuid, { nuid: p.nuid, name: p.name })
          }
        }
        setPeers([...seen.values()])
      })

    let seedTimer: ReturnType<typeof setTimeout> | null = null
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      void channel.track({ nuid: meNuid, name: meName ?? meNuid })
      void channel.send({
        type: 'broadcast',
        event: 'sync-request',
        payload: { from: meNuid, sv: toBase64(Y.encodeStateVector(doc)) },
      })
      seedTimer = setTimeout(() => {
        const init = initialRef.current
        if (!gotReply && init && ytext.length === 0 && ymap.size === 0) {
          Y.applyUpdate(doc, seedUpdate(init.text, init.fields))
        }
        setTextState(ytext.toString())
        setFieldsState(readFields(ymap))
        setReady(true)
      }, SYNC_WAIT_MS)
    })

    return () => {
      if (seedTimer) clearTimeout(seedTimer)
      clearInterval(typingTimer)
      lockedRef.current = false
      setTypingPeers([])
      if (flushTimer) clearTimeout(flushTimer)
      flush()
      void supabase.removeChannel(channel)
      channelRef.current = null
      docRef.current = null
      doc.destroy()
      setPeers([])
      setReady(false)
    }
  }, [room, hasInitial, meNuid, meName])

  useLayoutEffect(() => {
    const sel = pendingSelection.current
    const el = textareaRef.current
    if (!sel || !el) return
    pendingSelection.current = null
    el.setSelectionRange(sel[0], sel[1])
  }, [text])

  const onTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const doc = docRef.current
      if (!doc || lockedRef.current) return
      const now = Date.now()
      lastLocalTypeAt.current = now
      if (now - lastPingAt.current > TYPING_PING_MS) {
        lastPingAt.current = now
        void channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { nuid: meNuid, name: meName ?? meNuid },
        })
      }
      const ytext = doc.getText('writeup')
      const prev = ytext.toString()
      const next = e.target.value
      let start = 0
      while (
        start < prev.length &&
        start < next.length &&
        prev[start] === next[start]
      )
        start++
      let endPrev = prev.length
      let endNext = next.length
      while (
        endPrev > start &&
        endNext > start &&
        prev[endPrev - 1] === next[endNext - 1]
      ) {
        endPrev--
        endNext--
      }
      doc.transact(() => {
        if (endPrev > start) ytext.delete(start, endPrev - start)
        if (endNext > start) ytext.insert(start, next.slice(start, endNext))
      }, LOCAL)
    },
    [meNuid, meName]
  )

  const setField = useCallback((key: keyof InterviewFields, value: string) => {
    const doc = docRef.current
    if (!doc) return
    doc.transact(() => {
      const map = doc.getMap<string>('fields')
      if (value) map.set(key, value)
      else map.delete(key)
    }, LOCAL)
  }, [])

  const notifySaved = useCallback(() => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'saved',
      payload: {},
    })
  }, [])

  return {
    ready,
    text,
    fields,
    peers,
    typingPeers,
    textareaRef,
    onTextChange,
    setField,
    notifySaved,
  }
}

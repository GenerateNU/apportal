import { MembersClient } from './components/MembersClient'

// Auth-gated, live data fetched per request from the backend — never prerender
// this at build time (the backend isn't running then). No server prefetch
// here: this page's data comes from an infinite query, and hand-matching
// orval's internal page-param/query-key format for prefetchInfiniteQuery
// isn't worth it for the first infinite query in the app — MembersClient
// just fetches client-side on mount instead.
export const dynamic = 'force-dynamic'

export default function MembersPage() {
  return <MembersClient />
}

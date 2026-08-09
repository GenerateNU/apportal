# apportal

Go + huma backend (`backend/`), Next.js + TanStack Query frontend (`frontend/`).
The frontend API client is generated from the backend's OpenAPI spec — after
changing a handler's inputs or outputs, run `make openapi` in `backend/` and
`npm run generate:api` in `frontend/`.

## Keep comments short

One or two lines, three at the outside. Comment only what the code can't say —
a non-obvious *why*, a constraint, a gotcha — and delete the rest. If the
signature, the class names, or the next line already says it, say nothing.

Don't narrate rejected alternatives, restate design rationale, or explain how a
CSS or library feature works. A comment that needs a paragraph is usually a
sign the code needs the work instead.

## Never fetch per item — batch it

**If a page renders N items and needs data for each one, fetch it in one
request, not N.** Build a bulk endpoint that takes the ids and returns them
together. This applies to any per-row detail: answers, reviews, assignments,
counts.

The N-request version looks fine locally with three rows and falls apart at
scale — browsers cap concurrent connections per host (~6), so the requests
queue in waves and the page fills in raggedly, each one paying its own round
trip, auth middleware, and query planning.

What this looks like here:

- **Backend:** a collection route (`GET /answers?application_ids=a,b,c`)
  alongside the single-item one, backed by `WHERE id = ANY($1::uuid[])`.
  Bound the list (`maxBulkApplications`) so the query string and the fan-out
  stay sane, and apply the same visibility rules the single-item route does.
- **Frontend:** one query per *batch*, keyed on the id list. Where rows arrive
  in pages (infinite scroll), batch per page so loading more doesn't refetch
  what's already in hand. Write each response back into the per-item cache
  entries with `queryClient.setQueryData` so single-item views stay warm — the
  point is fewer requests, not a worse cache.

`useAnswersByApplicationIdBatches` in `frontend/src/lib/queries/answers.ts` is
the worked example.

## Query params the generated client can actually send

huma binds only primitives from a query string, and axios serializes arrays as
`key[]=…` and objects as `key[0][field]=…` — neither of which huma reads. A
`[]struct` query field silently binds nothing, or panics at request time.

So for anything that isn't a scalar, take a `string` and parse it in the
handler: JSON for structured filters (`answer_filters`), comma-separated for
id lists (`application_ids`). Return 422 on malformed input.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Reachable without a session. /auth/confirm redeems the one-time token from
// an emailed link, so it has to run for signed-in users too — otherwise
// clicking a reset link in an already-authenticated browser bounces to / and
// the token is never spent.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/auth/confirm']
const SIGNED_OUT_ONLY_PATHS = ['/login', '/signup', '/forgot-password']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() (not getUser()) deliberately: Proxy runs on every request —
  // including prefetches, which Next.js strips the distinguishing headers
  // from before Proxy sees them, so there's no way to skip them here. Two
  // independent Supabase clients (this one and the browser's, which
  // refreshes on every API call) racing to redeem the same one-time-use
  // rotating refresh token was bouncing actively-used sessions to /login.
  // getSession() only reads/refreshes the local cookie, no extra network
  // hop to revalidate — Proxy is a UX/routing decision here, not the real
  // security boundary: the backend independently re-verifies every bearer
  // token against Supabase on every API call regardless of what Proxy
  // decides, so a forged cookie that fooled this check would still fail
  // every real data request.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return noStore(NextResponse.redirect(redirectUrl))
  }

  const isSignedOutOnlyPath = SIGNED_OUT_ONLY_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (user && isSignedOutOnlyPath) {
    return noStore(NextResponse.redirect(new URL('/', request.url)))
  }

  return noStore(response)
}

// Every response Proxy returns is session-dependent: it either carries a
// refreshed Supabase cookie or reflects a signed-in/signed-out routing
// decision. None of it may sit in a shared cache.
//
// Cache-Control alone does not do this on Netlify. Netlify's CDN reads
// Netlify-CDN-Cache-Control and falls back to a *default* of
// `public, s-maxage=31536000, must-revalidate` — so `Cache-Control:
// private, no-store` reaches the browser while the CDN still stores the
// response for a year, keyed on the URL with the auth cookie absent from
// Netlify-Vary. That is how one user's session ends up served to another.
// See: https://docs.netlify.com/build/caching/caching-overview
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Netlify-CDN-Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

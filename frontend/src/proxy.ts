import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Reachable without a session. /auth/confirm redeems the one-time token from
// an emailed link, so it has to run for signed-in users too — otherwise
// clicking a reset link in an already-authenticated browser bounces to / and
// the token is never spent.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/auth/confirm']
const SIGNED_OUT_ONLY_PATHS = ['/login', '/signup', '/forgot-password']

// getSession() above may have rotated the refresh token, which invalidates the
// one the browser still holds. Those new cookies live on the NextResponse.next()
// we built for the pass-through case, so a redirect that returns a fresh
// response instead would strand the browser on a spent token — every later
// refresh fails with "Already Used" and the session dies mid-use.
function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
  return to
}

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
  // from before Proxy sees them, so there's no way to skip them here. Proxy
  // is a UX/routing decision, not the real security boundary: the backend
  // re-verifies every bearer token against Supabase on every API call, so a
  // forged cookie that fooled this check would still fail every data request.
  //
  // Note getSession() is NOT network-free: within EXPIRY_MARGIN_MS (90s) of
  // expiry it POSTs /token?grant_type=refresh_token and rotates the
  // single-use refresh token. Whatever it hands back must reach the browser
  // — see copyAuthCookies.
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
    return copyAuthCookies(response, NextResponse.redirect(redirectUrl))
  }

  const isSignedOutOnlyPath = SIGNED_OUT_ONLY_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (user && isSignedOutOnlyPath) {
    return copyAuthCookies(
      response,
      NextResponse.redirect(new URL('/', request.url))
    )
  }

  // Prevent CDN/ISR caching of responses that may contain Set-Cookie headers.
  // Without this, CDNs can cache auth tokens and serve them to different users,
  // causing session cross-contamination (users logged in as each other).
  // See: https://github.com/supabase/supabase-js/issues/1682
  response.headers.set('Cache-Control', 'private, no-store')

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

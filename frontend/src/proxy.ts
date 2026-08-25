import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']

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
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url))
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

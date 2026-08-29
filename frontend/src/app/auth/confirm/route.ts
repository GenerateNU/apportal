import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Redeems the one-time token from an emailed auth link (password recovery,
// email confirmation) and turns it into a session, then forwards to `next`.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  // Only same-origin paths, so a crafted link can't bounce users off-site.
  const nextParam = searchParams.get('next') ?? '/'
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'

  // Cookies must be written onto the response we actually return — the
  // next/headers store doesn't propagate onto a NextResponse built here, so
  // the new session would be dropped and `next` would bounce to /login.
  const response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Templates using {{ .TokenHash }} land here; templates using the default
  // {{ .ConfirmationURL }} come back through Supabase as a PKCE ?code=.
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        type: type ?? 'recovery',
        token_hash: tokenHash,
      })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: { message: 'Reset link was missing its token' } }

  if (error) {
    const failed = new URL('/forgot-password', request.url)
    failed.searchParams.set('error', 'invalid_link')
    failed.searchParams.set('reason', error.message)
    return NextResponse.redirect(failed)
  }

  return response
}

import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const supabase = await createClient()

  // Templates using {{ .TokenHash }} land here; templates using the default
  // {{ .ConfirmationURL }} come back through Supabase as a PKCE ?code=.
  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        type: type ?? 'recovery',
        token_hash: tokenHash,
      })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('missing token') }

  if (error) {
    return NextResponse.redirect(
      new URL('/forgot-password?error=invalid_link', request.url)
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}

'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const linkInvalid = searchParams.get('error') === 'invalid_link'
  const linkFailureReason = searchParams.get('reason')

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setIsSubmitting(false)
      return
    }

    setSent(true)
    setIsSubmitting(false)
  }

  // Same confirmation whether or not the address has an account — the reset
  // form must not become a way to test which emails are registered.
  if (sent) {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          If an account exists for {email}, a reset link is on its way. The link
          expires in one hour.
        </p>
        <p className="text-text-secondary text-center text-sm">
          <Link href="/login" className="text-brand-blue font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      {linkInvalid && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          That reset link is invalid or has expired. Request a new one below.
          {linkFailureReason && (
            <span className="mt-1 block text-xs opacity-80">
              {linkFailureReason}
            </span>
          )}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-text-secondary text-sm font-medium"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-blue text-brand-white mt-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-text-secondary text-center text-sm">
        Remembered it?{' '}
        <Link href="/login" className="text-brand-blue font-medium">
          Sign in
        </Link>
      </p>
    </form>
  )
}

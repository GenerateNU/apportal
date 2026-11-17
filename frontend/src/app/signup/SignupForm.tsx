'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { APIError } from '@/lib/api/client'
import { ensureProfile } from '@/lib/auth/ensure-profile'

export default function SignupForm() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [nuid, setNuid] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!email.trim().toLowerCase().endsWith('@northeastern.edu')) {
      setError('Use your @northeastern.edu email')
      return
    }

    setIsSubmitting(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nuid: nuid.trim(), full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsSubmitting(false)
      return
    }

    if (!data.session) {
      setConfirmEmail(email)
      setIsSubmitting(false)
      return
    }

    try {
      await ensureProfile(data.session)
    } catch (err) {
      setError(
        err instanceof APIError && err.status === 409
          ? 'That NUID is already registered.'
          : 'Account created, but saving your profile failed. Sign in to try again.'
      )
      setIsSubmitting(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (confirmEmail) {
    return (
      <div className="flex w-full flex-col gap-3 text-center">
        <p className="text-ink font-semibold">Check your email</p>
        <p className="text-text-muted text-sm">
          We sent a confirmation link to {confirmEmail}. Open it to finish
          creating your account.
        </p>
        <Link href="/login" className="text-ink text-sm underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="fullName"
          className="text-text-secondary text-sm font-medium"
        >
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="text-text-default focus:border-ink focus:ring-ink rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nuid"
          className="text-text-secondary text-sm font-medium"
        >
          NUID
        </label>
        <input
          id="nuid"
          name="nuid"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          value={nuid}
          onChange={(event) => setNuid(event.target.value)}
          className="text-text-default focus:border-ink focus:ring-ink rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

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
          placeholder="you@northeastern.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="text-text-default focus:border-ink focus:ring-ink rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-text-secondary text-sm font-medium"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="text-text-default focus:border-ink focus:ring-ink rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-text-secondary text-sm font-medium"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="text-text-default focus:border-ink focus:ring-ink rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-ink text-brand-white mt-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-text-secondary text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-ink font-medium">
          Sign in
        </Link>
      </p>
    </form>
  )
}

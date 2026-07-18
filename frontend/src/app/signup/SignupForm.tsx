'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { upsertApplicant } from '@/generated/applicants/applicants'

export default function SignupForm() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [nuid, setNuid] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsSubmitting(false)
      return
    }

    // Every new account starts as an applicant — upsertApplicant never sets
    // roles, so the users table default of {applicant} applies.
    try {
      await upsertApplicant({ nuid, email, full_name: fullName })
    } catch {
      setError(
        'Account created, but saving your profile failed. Try again from your dashboard.'
      )
      setIsSubmitting(false)
      return
    }

    router.push('/')
    router.refresh()
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
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
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
          required
          value={nuid}
          onChange={(event) => setNuid(event.target.value)}
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
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
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
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
          className="text-text-default focus:border-brand-blue focus:ring-brand-blue rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-blue text-brand-white mt-2 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-text-secondary text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-blue font-medium">
          Sign in
        </Link>
      </p>
    </form>
  )
}

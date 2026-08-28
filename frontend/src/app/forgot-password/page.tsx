import Image from 'next/image'
import { Suspense } from 'react'
import { HelpContact } from '@/components/HelpContact'
import ForgotPasswordForm from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/GenerateNU Logo.png"
            alt="GenerateNU"
            width={36}
            height={36}
            className="object-contain"
          />
          <h1 className="text-text-default text-lg font-semibold">
            Reset your password
          </h1>
          <p className="text-text-secondary text-center text-sm">
            Enter your email and we&apos;ll send you a link to set a new
            password.
          </p>
        </div>

        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      </div>

      <HelpContact className="max-w-sm" />
    </div>
  )
}

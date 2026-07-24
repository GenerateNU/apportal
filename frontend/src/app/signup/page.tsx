import Image from 'next/image'
import { HelpContact } from '@/components/HelpContact'
import SignupForm from './SignupForm'

export default function SignupPage() {
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
            Create your Generate account
          </h1>
        </div>

        <SignupForm />
      </div>

      <HelpContact className="max-w-sm" />
    </div>
  )
}

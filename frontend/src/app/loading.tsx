import { HelpContact } from '@/components/HelpContact'

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary size-8 animate-spin rounded-full border-4"
      />
      <HelpContact className="max-w-sm" />
    </div>
  )
}

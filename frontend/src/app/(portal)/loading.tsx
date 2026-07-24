import { HelpContact } from '@/components/HelpContact'

export default function PortalLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div
        role="status"
        aria-label="Loading"
        className="border-text-faint border-t-primary size-8 animate-spin rounded-full border-4"
      />
      <HelpContact className="max-w-sm" />
    </div>
  )
}
